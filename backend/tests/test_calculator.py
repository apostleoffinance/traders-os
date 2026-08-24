"""Deterministic calculator engine tests — no LLM, no DB."""

from decimal import Decimal

from app.core.enums import Direction
from app.engines.calculator import CalcMode, CalculatorInput, calculate
from app.engines.calculator.policy import PolicyLimits, assess_policy
from app.engines.fx_math import get_instrument, position_size_from_risk


def _base(**kwargs) -> CalculatorInput:
    data = dict(
        mode=CalcMode.RISK_TO_LEVELS,
        symbol="EURUSD",
        direction="short",
        entry=Decimal("1.16646"),
        account_balance=Decimal("1000"),
        quote_to_account_rate=Decimal("1"),
        lot_size=Decimal("0.01"),
        risk_amount=Decimal("5"),
        reward_amount=Decimal("10"),
    )
    data.update(kwargs)
    return CalculatorInput(**data)


def test_risk_to_levels_eurusd_short_acceptance() -> None:
    result = calculate(_base())
    assert result.ok
    assert result.stop_loss == Decimal("1.17146")
    assert result.take_profit == Decimal("1.15646")
    assert result.risk_amount == Decimal("5.00")
    assert result.reward_amount == Decimal("10.00")
    assert result.planned_rr == Decimal("2.00")
    assert result.risk_percent == Decimal("0.5000")
    assert result.stop_pips == Decimal("50.0")
    assert result.tp_pips == Decimal("100.0")


def test_entry_sl_to_size_floors_risk() -> None:
    result = calculate(
        CalculatorInput(
            mode=CalcMode.FIXED_RISK_SL,
            symbol="EURUSD",
            direction="long",
            entry=Decimal("1.08500"),
            stop_loss=Decimal("1.08400"),
            risk_amount=Decimal("5.00"),
            account_balance=Decimal("1000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    assert result.lot_size == Decimal("0.05")
    assert result.risk_amount == Decimal("5.00")
    assert result.requested_risk == Decimal("5.00")
    assert result.risk_difference == Decimal("0.00")


def test_trade_analysis_mode() -> None:
    result = calculate(
        CalculatorInput(
            mode=CalcMode.TRADE_ANALYSIS,
            symbol="EURUSD",
            direction="long",
            entry=Decimal("1.08500"),
            stop_loss=Decimal("1.08400"),
            take_profit=Decimal("1.08700"),
            lot_size=Decimal("0.05"),
            account_balance=Decimal("1000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    assert result.risk_amount == Decimal("5.00")
    assert result.reward_amount == Decimal("10.00")
    assert result.planned_rr == Decimal("2.00")


def test_target_distance_mode() -> None:
    result = calculate(
        CalculatorInput(
            mode=CalcMode.TARGET_DISTANCE,
            symbol="EURUSD",
            direction="short",
            entry=Decimal("1.16646"),
            lot_size=Decimal("0.01"),
            reward_amount=Decimal("10"),
            account_balance=Decimal("1000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    assert result.take_profit == Decimal("1.15646")
    assert result.tp_pips == Decimal("100.0")


def test_wrong_side_sl_notes() -> None:
    result = calculate(
        CalculatorInput(
            mode=CalcMode.TRADE_ANALYSIS,
            symbol="EURUSD",
            direction="long",
            entry=Decimal("1.08500"),
            stop_loss=Decimal("1.08600"),
            lot_size=Decimal("0.01"),
            account_balance=Decimal("1000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    assert any("below entry" in n for n in result.notes)


def test_zero_risk_fails() -> None:
    result = calculate(_base(risk_amount=Decimal("0")))
    assert not result.ok


def test_unknown_symbol() -> None:
    result = calculate(_base(symbol="FAKEPAIR"))
    assert not result.ok


def test_xauusd_risk_uses_contract_size() -> None:
    # 1.00 price move, 0.01 lot, contract 100 → $1.00 risk
    result = calculate(
        CalculatorInput(
            mode=CalcMode.TRADE_ANALYSIS,
            symbol="XAUUSD",
            direction="long",
            entry=Decimal("2400.00"),
            stop_loss=Decimal("2399.00"),
            lot_size=Decimal("0.01"),
            account_balance=Decimal("1000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    assert result.risk_amount == Decimal("1.00")
    assert get_instrument("XAUUSD").contract_size == Decimal("100")


def test_btcusdt_quantity_risk() -> None:
    result = calculate(
        CalculatorInput(
            mode=CalcMode.TRADE_ANALYSIS,
            symbol="BTCUSDT",
            direction="long",
            entry=Decimal("60000"),
            stop_loss=Decimal("59000"),
            lot_size=Decimal("0.01"),
            account_balance=Decimal("10000"),
            quote_to_account_rate=Decimal("1"),
        )
    )
    assert result.ok
    # |60000-59000| * 0.01 * 1 = 10
    assert result.risk_amount == Decimal("10.00")


def test_missing_conversion_fails_engine() -> None:
    result = calculate(_base(quote_to_account_rate=Decimal("0")))
    assert not result.ok


def test_policy_red_when_over_risk() -> None:
    assessment = assess_policy(
        limits=PolicyLimits(
            risk_per_trade=Decimal("5"),
            hard_risk_per_trade=None,
            preferred_min_rr=Decimal("1.5"),
            personal_daily_loss_limit=Decimal("50"),
            daily_risk_used=Decimal("0"),
            daily_pnl=Decimal("0"),
            equity=Decimal("1000"),
            balance=Decimal("1000"),
            distance_to_personal_daily_loss=Decimal("50"),
            distance_to_personal_max_dd=Decimal("50"),
            distance_to_firm_max_dd=Decimal("50"),
            snapshot_status="green",
        ),
        risk_amount=Decimal("8"),
        reward_amount=Decimal("16"),
        risk_percent=Decimal("0.8"),
        planned_rr=Decimal("2"),
    )
    assert assessment.status == "red"
    assert "exceeds" in assessment.headline.lower() or any("exceeds" in d.lower() for d in assessment.details)


def test_position_size_never_exceeds_requested_risk_usdcad() -> None:
    from app.core.enums import Direction

    sized = position_size_from_risk(
        symbol="USDCAD",
        entry=Decimal("1.35000"),
        stop_loss=Decimal("1.34800"),
        risk_amount=Decimal("5.00"),
        account_balance=Decimal("1000"),
        quote_to_account_rate=Decimal("1") / Decimal("1.35"),
        direction=Direction.LONG,
    )
    assert sized["risk_amount"] <= Decimal("5.00")
    assert sized["lot_size"] > Decimal("0")
