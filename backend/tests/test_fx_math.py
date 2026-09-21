from decimal import Decimal

from app.core.enums import Direction, TradeResult, TradeStatus
from app.engines.fx_math import (
    classify_result,
    planned_metrics,
    position_size_from_risk,
    realized_pnl,
    realized_r,
    to_pips,
    get_instrument,
    price_distance,
)
from app.engines.price_movement import MovementUnit, calculate_price_movement, trade_movement_metrics


def test_eurusd_10_pip_micro_lot_risk_is_one_dollar() -> None:
    m = planned_metrics(
        symbol="EURUSD",
        direction=Direction.LONG,
        entry=Decimal("1.08500"),
        stop_loss=Decimal("1.08400"),
        take_profit=Decimal("1.08700"),
        lot_size=Decimal("0.01"),
        account_balance=Decimal("1000"),
    )
    assert m["stop_pips"] == Decimal("10.0")
    assert m["tp_pips"] == Decimal("20.0")
    assert m["risk_amount"] == Decimal("1.00")
    assert m["planned_reward"] == Decimal("2.00")
    assert m["planned_rr"] == Decimal("2.00")
    assert m["risk_percent"] == Decimal("0.1000")


def test_eurusd_five_dollar_risk_unit() -> None:
    # 10 pips, 0.05 lot → $5
    m = planned_metrics(
        symbol="EURUSD",
        direction=Direction.SHORT,
        entry=Decimal("1.08500"),
        stop_loss=Decimal("1.08600"),
        take_profit=Decimal("1.08300"),
        lot_size=Decimal("0.05"),
        account_balance=Decimal("1000"),
    )
    assert m["risk_amount"] == Decimal("5.00")
    assert m["planned_rr"] == Decimal("2.00")


def test_realized_pnl_long_win() -> None:
    pnl = realized_pnl(
        symbol="EURUSD",
        direction=Direction.LONG,
        entry=Decimal("1.08500"),
        exit_price=Decimal("1.08700"),
        lot_size=Decimal("0.05"),
    )
    assert pnl == Decimal("10.00")
    assert realized_r(pnl, Decimal("5.00")) == Decimal("2.00")


def test_realized_pnl_short_loss() -> None:
    pnl = realized_pnl(
        symbol="EURUSD",
        direction=Direction.SHORT,
        entry=Decimal("1.08500"),
        exit_price=Decimal("1.08600"),
        lot_size=Decimal("0.05"),
    )
    assert pnl == Decimal("-5.00")
    assert realized_r(pnl, Decimal("5.00")) == Decimal("-1.00")


def test_breakeven_classification() -> None:
    assert classify_result(TradeStatus.CLOSED, Decimal("0.00")) == TradeResult.BREAKEVEN
    assert classify_result(TradeStatus.OPEN, None) == TradeResult.OPEN
    assert classify_result(TradeStatus.CLOSED, Decimal("1.00")) == TradeResult.WIN
    assert classify_result(TradeStatus.CLOSED, Decimal("-1.00")) == TradeResult.LOSS


def test_position_size_from_five_dollar_eurusd_risk() -> None:
    sized = position_size_from_risk(
        symbol="EURUSD",
        entry=Decimal("1.08500"),
        stop_loss=Decimal("1.08400"),
        risk_amount=Decimal("5.00"),
        account_balance=Decimal("1000"),
        quote_to_account_rate=Decimal("1"),
        take_profit=Decimal("1.08700"),
        direction=Direction.LONG,
    )
    assert sized["lot_size"] == Decimal("0.05")
    assert sized["risk_amount"] == Decimal("5.00")
    assert sized["planned_rr"] == Decimal("2.00")


def test_usdjpy_size_uses_conversion_rate() -> None:
    # 10 pip (0.10 JPY) stop, $5 risk, USDJPY=150 → rate = 1/150
    # Floor sizing: raw ≈ 0.075 → 0.07 lots → risk ≈ $4.67 (does not exceed $5)
    sized = position_size_from_risk(
        symbol="USDJPY",
        entry=Decimal("150.00"),
        stop_loss=Decimal("149.90"),
        risk_amount=Decimal("5.00"),
        account_balance=Decimal("1000"),
        quote_to_account_rate=Decimal("1") / Decimal("150"),
        direction=Direction.LONG,
    )
    assert sized["lot_size"] == Decimal("0.07")
    assert sized["risk_amount"] == Decimal("4.67")
    assert sized["risk_amount"] <= Decimal("5.00")
    assert sized["requested_risk"] == Decimal("5.00")


def test_pip_distance() -> None:
    spec = get_instrument("EURUSD")
    assert to_pips(price_distance(Decimal("1.10000"), Decimal("1.09950")), spec) == Decimal("5.0")


def test_price_movement_uses_fractional_fx_pips() -> None:
    movement = calculate_price_movement(
        instrument="EURUSD",
        from_price=Decimal("1.10000"),
        to_price=Decimal("1.10475"),
    )
    assert movement.unit == MovementUnit.PIP
    assert movement.absolute == Decimal("47.5")


def test_price_movement_uses_jpy_pip_size() -> None:
    movement = calculate_price_movement(
        instrument="USDJPY",
        from_price=Decimal("150.00"),
        to_price=Decimal("150.50"),
    )
    assert movement.unit == MovementUnit.PIP
    assert movement.absolute == Decimal("50.0")


def test_direction_aware_trade_movement_and_capture() -> None:
    metrics = trade_movement_metrics(
        symbol="EURUSD",
        direction=Direction.SHORT,
        entry=Decimal("1.16646"),
        stop_loss=Decimal("1.17121"),
        take_profit=Decimal("1.15666"),
        exit_price=Decimal("1.15882"),
        mfe_price=Decimal("1.15736"),
        mae_price=Decimal("1.16826"),
    )
    assert metrics["risk"] == Decimal("47.5")
    assert metrics["target"] == Decimal("98.0")
    assert metrics["realized"] == Decimal("76.4")
    assert metrics["mfe"] == Decimal("91.0")
    assert metrics["mae"] == Decimal("18.0")
    assert metrics["capture_percent"] == Decimal("83.96")


def test_non_fx_movement_uses_catalog_unit() -> None:
    gold = calculate_price_movement(
        instrument="XAUUSD",
        from_price=Decimal("2400.00"),
        to_price=Decimal("2412.50"),
    )
    crypto = calculate_price_movement(
        instrument="BTCUSDT",
        from_price=Decimal("76000"),
        to_price=Decimal("75200"),
    )
    assert gold.unit == MovementUnit.PRICE_UNIT
    assert gold.absolute == Decimal("1250.0")
    assert crypto.unit == MovementUnit.CURRENCY
    assert crypto.absolute == Decimal("800")
