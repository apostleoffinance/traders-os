"""Server-side MFE/MAE backfill from OHLC market data."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Sequence

from sqlalchemy.orm import Session

from app.core.enums import Direction, TradeStatus
from app.core.time import as_utc
from app.engines.mfe_mae import excursions_in_r
from app.engines.trade_anatomy_path import bar_limit, timed_excursions_from_candles
from app.market_data.schemas import Candle
from app.market_data import service as market_service
from app.models.trade import Trade

log = logging.getLogger(__name__)


def compute_extreme_prices(
    candles: Sequence[Candle],
    *,
    direction: str,
    entry: Decimal,
) -> tuple[Decimal, Decimal] | None:
    timed = timed_excursions_from_candles(candles, direction=direction, entry=entry)
    if timed is None:
        return None
    return timed.mfe_price, timed.mae_price


def backfill_mfe_mae_for_trade(db: Session, trade: Trade) -> bool:
    """Fetch M1 OHLC for trade window and persist MFE/MAE (+ timestamps). Returns True if stored."""
    if trade.status != TradeStatus.CLOSED.value:
        return False
    needs_prices = trade.mfe_price is None or trade.mae_price is None
    needs_times = getattr(trade, "mfe_at", None) is None or getattr(trade, "mae_at", None) is None
    if not needs_prices and not needs_times:
        return False
    if trade.exit_timestamp is None or trade.trade_timestamp is None:
        return False
    if trade.entry_price is None or trade.stop_loss is None:
        return False

    start = as_utc(trade.trade_timestamp)
    end = as_utc(trade.exit_timestamp)
    if end <= start:
        return False

    try:
        candles = market_service.get_ohlcv_range(
            db,
            trade.symbol,
            "M1",
            start=start,
            end=end,
            limit=bar_limit(start, end),
        )
    except Exception as exc:
        log.info("mfe backfill unavailable trade=%s symbol=%s: %s", trade.id, trade.symbol, exc)
        return False

    timed = timed_excursions_from_candles(
        candles,
        direction=trade.direction,
        entry=Decimal(trade.entry_price),
        mfe_price=Decimal(trade.mfe_price) if trade.mfe_price is not None else None,
        mae_price=Decimal(trade.mae_price) if trade.mae_price is not None else None,
    )
    if timed is None:
        return False

    if needs_prices:
        trade.mfe_price = timed.mfe_price
        trade.mae_price = timed.mae_price
        mfe_r, mae_r = excursions_in_r(
            direction=Direction(trade.direction),
            entry=Decimal(trade.entry_price),
            stop_loss=Decimal(trade.stop_loss),
            mfe_price=timed.mfe_price,
            mae_price=timed.mae_price,
        )
        trade.mfe_r = mfe_r
        trade.mae_r = mae_r
        trade.mfe_mae_source = "server_m1"
        trade.mfe_mae_precision = "bar_ohlc"

    if timed.mfe_at is not None:
        trade.mfe_at = timed.mfe_at
    if timed.mae_at is not None:
        trade.mae_at = timed.mae_at
    return True
