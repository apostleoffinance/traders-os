"""PostgreSQL candle cache. Historical bars persist; only the last bar is refreshed."""

from __future__ import annotations

import threading
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time import as_utc, utcnow
from app.market_data.schemas import FRESHNESS_SECONDS, Candle
from app.models.market import MarketCandle

_inflight: dict[str, threading.Lock] = {}
_guard = threading.Lock()


def inflight_key(provider: str, symbol: str, timeframe: str) -> str:
    return f"{provider}:{symbol}:{timeframe}"


def acquire_inflight(key: str) -> threading.Lock:
    with _guard:
        lock = _inflight.get(key)
        if lock is None:
            lock = threading.Lock()
            _inflight[key] = lock
        return lock


def load_cached(
    db: Session,
    *,
    provider: str,
    symbol: str,
    timeframe: str,
    limit: int,
) -> list[MarketCandle]:
    rows = (
        db.query(MarketCandle)
        .filter(
            MarketCandle.provider == provider,
            MarketCandle.symbol == symbol,
            MarketCandle.timeframe == timeframe,
        )
        .order_by(MarketCandle.timestamp.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return rows


def last_timestamp(rows: list[MarketCandle]) -> datetime | None:
    if not rows:
        return None
    return as_utc(rows[-1].timestamp)


def is_fresh(rows: list[MarketCandle], timeframe: str) -> bool:
    last = last_timestamp(rows)
    if last is None:
        return False
    window = FRESHNESS_SECONDS.get(timeframe, 300)
    return utcnow() - last <= timedelta(seconds=window)


def persist_candles(db: Session, candles: list[Candle]) -> int:
    if not candles:
        return 0
    provider, symbol, timeframe = candles[0].provider, candles[0].symbol, candles[0].timeframe
    stamps = [as_utc(c.timestamp) for c in candles]
    existing_rows = (
        db.query(MarketCandle)
        .filter(
            MarketCandle.provider == provider,
            MarketCandle.symbol == symbol,
            MarketCandle.timeframe == timeframe,
            MarketCandle.timestamp.in_(stamps),
        )
        .all()
    )
    by_ts = {as_utc(r.timestamp): r for r in existing_rows}
    written = 0
    for c in candles:
        ts = as_utc(c.timestamp)
        row = by_ts.get(ts)
        if row is not None:
            row.open = c.open
            row.high = c.high
            row.low = c.low
            row.close = c.close
            row.volume = c.volume
            continue
        db.add(
            MarketCandle(
                provider=c.provider,
                symbol=c.symbol,
                timeframe=c.timeframe,
                timestamp=ts,
                open=c.open,
                high=c.high,
                low=c.low,
                close=c.close,
                volume=c.volume,
            )
        )
        written += 1
    try:
        db.flush()
    except IntegrityError:
        db.flush()
    return written


def rows_to_payload(rows: list[MarketCandle]) -> list[dict]:
    return [
        {
            "symbol": r.symbol,
            "provider": r.provider,
            "timeframe": r.timeframe,
            "timestamp": as_utc(r.timestamp).isoformat().replace("+00:00", "Z"),
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        }
        for r in rows
    ]
