"""Server-side MFE/MAE backfill from OHLC market data."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import Direction, TradeStatus
from app.core.time import as_utc
from app.engines.fx_math import ZERO
from app.engines.mfe_mae import excursions_from_extremes, excursions_in_r
from app.market_data.schemas import Candle
from app.market_data import service as market_service
from app.models.trade import Trade

log = logging.getLogger(__name__)


def _bar_limit(start: datetime, end: datetime) -> int:
    minutes = max(int((end - start).total_seconds() // 60), 1)
    return min(minutes + 10, 5000)


def compute_extreme_prices(
    candles: Sequence[Candle],
    *,
    direction: str,
    entry: Decimal,
) -> tuple[Decimal, Decimal] | None:
    if not candles:
        return None
    max_high = max(c.high for c in candles)
    min_low = min(c.low for c in candles)
    return excursions_from_extremes(
        direction=direction,
        entry=entry,
        max_high=max_high,
        min_low=min_low,
    )


def backfill_mfe_mae_for_trade(db: Session, trade: Trade) -> bool:
    """Fetch M1 OHLC for trade window and persist MFE/MAE. Returns True if stored."""
    if trade.status != TradeStatus.CLOSED.value:
        return False
    if trade.mfe_price is not None and trade.mae_price is not None:
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
            limit=_bar_limit(start, end),
        )
    except Exception as exc:
        log.info("mfe backfill unavailable trade=%s symbol=%s: %s", trade.id, trade.symbol, exc)
        return False

    extremes = compute_extreme_prices(
        candles,
        direction=trade.direction,
        entry=Decimal(trade.entry_price),
    )
    if extremes is None:
        return False

    mfe_price, mae_price = extremes
    mfe_r, mae_r = excursions_in_r(
        direction=Direction(trade.direction),
        entry=Decimal(trade.entry_price),
        stop_loss=Decimal(trade.stop_loss),
        mfe_price=mfe_price,
        mae_price=mae_price,
    )

    trade.mfe_price = mfe_price
    trade.mae_price = mae_price
    trade.mfe_r = mfe_r
    trade.mae_r = mae_r
    trade.mfe_mae_source = "server_m1"
    trade.mfe_mae_precision = "bar_ohlc"
    return True
