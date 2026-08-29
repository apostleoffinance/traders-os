"""Server-side MFE/MAE backfill and deal aggregation."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from app.core.enums import TradeResult, TradeStatus
from app.engines.mfe_mae import aggregate_deal_economics, excursions_from_extremes
from app.services.mfe_mae_backfill import compute_extreme_prices


def test_aggregate_weighted_exit() -> None:
    deals = [
        SimpleNamespace(volume=Decimal("0.03"), price=Decimal("1.16500"), profit=Decimal("1"), commission=Decimal("-0.01"), swap=Decimal("0")),
        SimpleNamespace(volume=Decimal("0.07"), price=Decimal("1.16400"), profit=Decimal("2"), commission=Decimal("-0.02"), swap=Decimal("0")),
    ]
    totals = aggregate_deal_economics(deals)
    assert totals.net_pnl == Decimal("2.97")
    assert totals.closed_volume == Decimal("0.10")
    assert totals.weighted_exit_price == Decimal("1.16430")


def test_excursions_from_extremes_long() -> None:
    mfe, mae = excursions_from_extremes(
        direction="long",
        entry=Decimal("1.10"),
        max_high=Decimal("1.106"),
        min_low=Decimal("1.098"),
    )
    assert mfe == Decimal("1.106")
    assert mae == Decimal("1.098")


def test_compute_extreme_prices_from_candles() -> None:
    class C:
        def __init__(self, h, l):
            self.high = Decimal(h)
            self.low = Decimal(l)

    result = compute_extreme_prices(
        [C("1.106", "1.099"), C("1.104", "1.098")],
        direction="long",
        entry=Decimal("1.10"),
    )
    assert result == (Decimal("1.106"), Decimal("1.098"))
