"""Strategy research experiment tests — deterministic cohort and cost stress."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.strategy_experiment import build_strategy_experiment


def _trade(day: int, pnl: Decimal) -> AnalyticsTrade:
    entry = datetime(2026, 1, day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 1, day, 10, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"trade-{day}",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup="breakout",
        setup_id="breakout",
        timeframe="H4",
        entry_at=entry,
        exit_at=exit_at,
        entry_price=Decimal("1.1000"),
        exit_price=Decimal("1.1100"),
        lot_size=Decimal("0.1"),
        risk_amount=Decimal("10"),
        risk_percent=Decimal("1"),
        commission=Decimal("-0.5"),
        swap=Decimal("-0.1"),
        realized_pnl=pnl,
        realized_r=pnl / Decimal("10"),
        holding_time_seconds=3600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS if pnl < 0 else TradeResult.BREAKEVEN,
        status=TradeStatus.CLOSED,
        emotion_before=None,
    )


def test_strategy_experiment_is_reproducible_and_cost_stress_reduces_net_pnl() -> None:
    trades = [_trade(day, Decimal("10") if day % 3 else Decimal("-5")) for day in range(1, 11)]
    context = {"filters": {"symbol": "EURUSD"}, "timezone": "UTC"}
    first = build_strategy_experiment(
        trades,
        starting=Decimal("1000"),
        split_ratio=0.7,
        additional_cost_per_trade=Decimal("2"),
        research_context=context,
    )
    second = build_strategy_experiment(
        trades,
        starting=Decimal("1000"),
        split_ratio=0.7,
        additional_cost_per_trade=Decimal("2"),
        research_context=context,
    )

    assert first["dataset_fingerprint"] == second["dataset_fingerprint"]
    assert first["experiment_id"] == second["experiment_id"]
    assert first["research_context"] == context
    assert first["data_quality"]["valid_quant_trades"] == 10
    assert first["cost_sensitivity"][0]["sample_size"] == 10
    assert first["cost_sensitivity"][0]["in_sample"]["n"] == 7
    assert first["cost_sensitivity"][0]["out_of_sample"]["n"] == 3
    assert Decimal(first["cost_sensitivity"][1]["net_pnl"]) == Decimal(first["cost_sensitivity"][0]["net_pnl"]) - Decimal("20.00")
    assert Decimal(first["cost_sensitivity"][2]["net_pnl"]) == Decimal(first["cost_sensitivity"][0]["net_pnl"]) - Decimal("40.00")
    assert first["recorded_costs"]["commission_and_swap_absolute_total"] == Decimal("6.00")
    assert "not a candle-level backtest" in first["disclaimer"].lower()


def test_strategy_experiment_rejects_invalid_split_and_cost() -> None:
    trades = [_trade(day, Decimal("5")) for day in range(1, 4)]
    with pytest.raises(ValueError, match="split_ratio"):
        build_strategy_experiment(trades, starting=Decimal("1000"), split_ratio=0.95)
    with pytest.raises(ValueError, match="additional_cost_per_trade"):
        build_strategy_experiment(trades, starting=Decimal("1000"), additional_cost_per_trade=Decimal("-1"))
