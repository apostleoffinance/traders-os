"""MFE/MAE excursion calculations."""

from __future__ import annotations

from decimal import Decimal

from app.core.enums import Direction
from app.engines.mfe_mae import exit_capture_ratio, excursions_in_r


def test_long_excursions() -> None:
    mfe_r, mae_r = excursions_in_r(
        direction=Direction.LONG,
        entry=Decimal("1.1000"),
        stop_loss=Decimal("1.0900"),
        mfe_price=Decimal("1.1060"),
        mae_price=Decimal("1.0980"),
    )
    assert mfe_r == Decimal("0.60")
    assert mae_r == Decimal("0.20")


def test_short_excursions() -> None:
    mfe_r, mae_r = excursions_in_r(
        direction=Direction.SHORT,
        entry=Decimal("1.16646"),
        stop_loss=Decimal("1.17121"),
        mfe_price=Decimal("1.16400"),
        mae_price=Decimal("1.16800"),
    )
    assert mfe_r == Decimal("0.52")
    assert mae_r == Decimal("0.32")


def test_exit_capture_winner() -> None:
    cap = exit_capture_ratio(Decimal("0.50"), Decimal("1.00"))
    assert cap == Decimal("0.50")


def test_exit_capture_invalid() -> None:
    assert exit_capture_ratio(Decimal("0.50"), Decimal("0")) is None
    assert exit_capture_ratio(Decimal("-0.50"), Decimal("1.00")) is None
