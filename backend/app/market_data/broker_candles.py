"""Account-scoped OHLC bars received from a connected MT5 terminal.

These rows are the broker series for that connection. They are never spliced
into Dukascopy or crypto candles.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.enums import AssetClass, InstrumentResolution, Mt5ConnectionStatus
from app.core.time import as_utc, utcnow
from app.engines.fx_math import get_instrument, normalize_symbol
from app.integrations.mt5.normalizer import resolve_mt5_symbol
from app.integrations.mt5.schemas import Mt5BarIn
from app.market_data.normalization import validate_ohlc
from app.market_data.schemas import FRESHNESS_SECONDS, Candle
from app.models.market import BrokerCandle
from app.models.mt5_connection import Mt5Connection

log = logging.getLogger("traderos.market")

BROKER_PROVIDER = "mt5"

_BAR_SECONDS = {
    "M1": 60,
    "M5": 300,
    "M15": 900,
    "M30": 1800,
    "H1": 3600,
    "H4": 14400,
    "D1": 86400,
}


def uses_broker_feed(symbol: str) -> bool:
    """FX and other broker instruments use MT5 bars. Crypto stays on its exchange feed."""
    try:
        spec = get_instrument(normalize_symbol(symbol))
    except Exception:
        return False
    return spec.asset_class != AssetClass.CRYPTO.value


def active_connection(db: Session, account_id) -> Mt5Connection | None:
    return (
        db.query(Mt5Connection)
        .filter(
            Mt5Connection.account_id == account_id,
            Mt5Connection.revoked_at.is_(None),
            Mt5Connection.status != Mt5ConnectionStatus.REVOKED.value,
        )
        .one_or_none()
    )


def store_bars(db: Session, connection: Mt5Connection, bars: list[Mt5BarIn], *, correct_time) -> int:
    """Upsert resolved bars. Invalid or unknown symbols are skipped, not invented."""
    written = 0
    now = utcnow()
    for bar in bars:
        resolution = resolve_mt5_symbol(bar.symbol_raw)
        if not resolution.symbol or resolution.instrument_status != InstrumentResolution.RESOLVED:
            log.info("MT5 bar skipped unresolved symbol=%s", bar.symbol_raw)
            continue
        if not uses_broker_feed(resolution.symbol):
            continue
        ts = correct_time(bar.timestamp, connection)
        if ts > now + timedelta(days=1):
            continue
        try:
            validate_ohlc(bar.open, bar.high, bar.low, bar.close)
        except ValueError:
            log.info("MT5 bar skipped invalid OHLC symbol=%s tf=%s", resolution.symbol, bar.timeframe)
            continue
        existing = (
            db.query(BrokerCandle)
            .filter(
                BrokerCandle.connection_id == connection.id,
                BrokerCandle.symbol == resolution.symbol,
                BrokerCandle.timeframe == bar.timeframe,
                BrokerCandle.timestamp == ts,
            )
            .one_or_none()
        )
        if existing is not None:
            existing.open = bar.open
            existing.high = bar.high
            existing.low = bar.low
            existing.close = bar.close
            existing.volume = bar.volume
            written += 1
            continue
        db.add(
            BrokerCandle(
                connection_id=connection.id,
                account_id=connection.account_id,
                symbol=resolution.symbol,
                timeframe=bar.timeframe,
                timestamp=ts,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
            )
        )
        written += 1
    db.flush()
    return written


def _to_candle(row: BrokerCandle) -> Candle:
    return Candle(
        symbol=row.symbol,
        provider=BROKER_PROVIDER,
        timeframe=row.timeframe,
        timestamp=as_utc(row.timestamp),
        open=row.open,
        high=row.high,
        low=row.low,
        close=row.close,
        volume=row.volume,
    )


def load_recent(db: Session, account_id, symbol: str, timeframe: str, *, limit: int) -> list[Candle]:
    connection = active_connection(db, account_id)
    if connection is None or not uses_broker_feed(symbol):
        return []
    key = normalize_symbol(symbol)
    rows = (
        db.query(BrokerCandle)
        .filter(
            BrokerCandle.connection_id == connection.id,
            BrokerCandle.symbol == key,
            BrokerCandle.timeframe == timeframe,
        )
        .order_by(BrokerCandle.timestamp.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [_to_candle(row) for row in rows]


def load_range(
    db: Session,
    account_id,
    symbol: str,
    timeframe: str,
    *,
    start: datetime,
    end: datetime,
    limit: int,
) -> list[Candle]:
    """Bars inside the window. Empty when the connection did not cover that window."""
    connection = active_connection(db, account_id)
    if connection is None or not uses_broker_feed(symbol):
        return []
    key = normalize_symbol(symbol)
    start_utc = as_utc(start)
    end_utc = as_utc(end)
    rows = (
        db.query(BrokerCandle)
        .filter(
            BrokerCandle.connection_id == connection.id,
            BrokerCandle.symbol == key,
            BrokerCandle.timeframe == timeframe,
            BrokerCandle.timestamp >= start_utc,
            BrokerCandle.timestamp <= end_utc,
        )
        .order_by(BrokerCandle.timestamp.asc())
        .limit(limit)
        .all()
    )
    candles = [_to_candle(row) for row in rows]
    if not _covers(candles, start_utc, end_utc, timeframe):
        return []
    return candles


def _covers(candles: list[Candle], start: datetime, end: datetime, timeframe: str) -> bool:
    if not candles:
        return False
    span = timedelta(seconds=_BAR_SECONDS.get(timeframe, 60))
    first = as_utc(candles[0].timestamp)
    last = as_utc(candles[-1].timestamp)
    return first <= start + span and last + span >= end


def freshness_for(candles: list[Candle], timeframe: str) -> tuple[str, bool, str | None]:
    if not candles:
        return "stale", True, "No broker candles for this symbol."
    last = as_utc(candles[-1].timestamp)
    age = utcnow() - last
    window = FRESHNESS_SECONDS.get(timeframe, 300)
    if age <= timedelta(seconds=window):
        return "delayed", False, None
    return (
        "stale",
        True,
        "Broker candles are behind the terminal. Showing the last bars the connection sent.",
    )
