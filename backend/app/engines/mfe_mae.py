"""MFE/MAE excursion math — direction-aware, R-normalized via stop distance."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from app.core.enums import Direction
from app.engines.fx_math import ZERO, ratio

PRICE_QUANT = Decimal("0.000001")


@dataclass(frozen=True)
class DealEconomics:
    net_pnl: Decimal
    profit: Decimal
    commission: Decimal
    swap: Decimal
    closed_volume: Decimal
    weighted_exit_price: Decimal | None


def excursions_from_extremes(
    *,
    direction: str | Direction,
    entry: Decimal,
    max_high: Decimal,
    min_low: Decimal,
) -> tuple[Decimal, Decimal]:
    """Return favorable/adverse extreme price levels for the trade direction."""
    dir_val = direction.value if isinstance(direction, Direction) else str(direction).lower()
    if dir_val == Direction.LONG.value:
        return max_high, min_low
    return min_low, max_high


def excursions_in_r(
    *,
    direction: str | Direction,
    entry: Decimal,
    stop_loss: Decimal,
    mfe_price: Decimal,
    mae_price: Decimal,
) -> tuple[Decimal | None, Decimal | None]:
    """Return (mfe_r, mae_r) as non-negative R multiples using |entry - stop| as 1R."""
    risk_dist = abs(entry - stop_loss)
    if risk_dist <= ZERO:
        return None, None

    dir_val = direction.value if isinstance(direction, Direction) else str(direction).lower()
    if dir_val == Direction.LONG.value:
        mfe_dist = mfe_price - entry
        mae_dist = entry - mae_price
    else:
        mfe_dist = entry - mfe_price
        mae_dist = mae_price - entry

    mfe_r = ratio(max(mfe_dist, ZERO) / risk_dist) if mfe_dist is not None else None
    mae_r = ratio(max(mae_dist, ZERO) / risk_dist) if mae_dist is not None else None
    return mfe_r, mae_r


def exit_capture_ratio(realized_r: Decimal | None, mfe_r: Decimal | None) -> Decimal | None:
    """Fraction of maximum favorable excursion captured on a winning trade."""
    if realized_r is None or mfe_r is None or mfe_r <= ZERO:
        return None
    if realized_r <= ZERO:
        return None
    return ratio(realized_r / mfe_r)


def aggregate_deal_economics(
    deals: Sequence[object],
) -> DealEconomics:
    """Sum MT5 closing deals; compute volume-weighted exit price."""
    profit = ZERO
    commission = ZERO
    swap = ZERO
    volume = ZERO
    notional = ZERO
    for deal in deals:
        profit += Decimal(getattr(deal, "profit", None) or 0)
        commission += Decimal(getattr(deal, "commission", None) or 0)
        swap += Decimal(getattr(deal, "swap", None) or 0)
        vol = Decimal(getattr(deal, "volume", None) or 0)
        price = getattr(deal, "price", None)
        if vol > ZERO and price is not None:
            volume += vol
            notional += Decimal(price) * vol
    net = profit + commission + swap
    weighted = (notional / volume).quantize(PRICE_QUANT) if volume > ZERO else None
    return DealEconomics(
        net_pnl=net,
        profit=profit,
        commission=commission,
        swap=swap,
        closed_volume=volume,
        weighted_exit_price=weighted,
    )
