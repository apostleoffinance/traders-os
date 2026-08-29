"""Quant Lab Phase E — behavior quant tests."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.behavioral_quant import (
    build_behavior_quant,
    build_discipline_comparisons,
    build_risk_escalation,
    explore_combination,
)
from app.engines.quant_lab.builder import build_quant_lab


def _row(
    *,
    pnl: Decimal,
    risk_pct: Decimal = Decimal("1"),
    day: int = 1,
    rules_followed: bool = True,
    emotional: bool = False,
    checklist_checked: int = 0,
    checklist_total: int = 0,
    mfe_r: Decimal | None = None,
    mae_r: Decimal | None = None,
) -> AnalyticsTrade:
    entry = datetime(2026, 3, day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 3, day, 10, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{day}",
        symbol="EURUSD",
        direction="long",
        session="london" if day % 2 else "new_york",
        setup="sweep",
        setup_id="s1",
        timeframe="M15",
        entry_at=entry,
        exit_at=exit_at,
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.11"),
        lot_size=Decimal("0.1"),
        risk_amount=Decimal("10"),
        risk_percent=risk_pct,
        commission=Decimal("0"),
        swap=Decimal("0"),
        realized_pnl=pnl,
        realized_r=pnl / Decimal("10"),
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=mfe_r,
        mae_r=mae_r,
        mfe_mae_source="test" if mfe_r else None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        emotion_before=None,
        rules_followed=rules_followed,
        emotional_trade=emotional,
        checklist_checked=checklist_checked,
        checklist_total=checklist_total,
    )


def test_discipline_alpha_difference() -> None:
    trades = [
        _row(pnl=Decimal("20"), rules_followed=True, day=1),
        _row(pnl=Decimal("10"), rules_followed=True, day=2),
        _row(pnl=Decimal("-15"), rules_followed=False, day=3),
        _row(pnl=Decimal("-10"), rules_followed=False, day=4),
    ]
    comp = build_discipline_comparisons(trades, starting=Decimal("10000"))
    rules = comp["comparisons"]["rules_followed_vs_broken"]
    assert rules["group_a"]["n"] == 2
    assert rules["group_b"]["n"] == 2
    assert rules["discipline_alpha_r"] is not None


def test_risk_escalation_after_loss() -> None:
    trades = [
        _row(pnl=Decimal("-10"), risk_pct=Decimal("1"), day=1),
        _row(pnl=Decimal("5"), risk_pct=Decimal("2"), day=2),
        _row(pnl=Decimal("-10"), risk_pct=Decimal("1"), day=3),
        _row(pnl=Decimal("5"), risk_pct=Decimal("2.5"), day=4),
        _row(pnl=Decimal("-10"), risk_pct=Decimal("1"), day=5),
        _row(pnl=Decimal("5"), risk_pct=Decimal("2"), day=6),
    ]
    esc = build_risk_escalation(trades, min_n=2)
    after_loss = next(p for p in esc["patterns"] if p["key"] == "after_loss")
    assert after_loss["n"] >= 2
    assert after_loss["average_risk_pct"] is not None


def test_combination_insufficient_sample() -> None:
    trades = [_row(pnl=Decimal("10"), day=i + 1) for i in range(5)]
    out = explore_combination(trades, starting=Decimal("10000"), conditions={"setup": "sweep"})
    assert out["insufficient_sample"] is True


def test_combination_sufficient_sample() -> None:
    trades = [_row(pnl=Decimal("10"), day=i + 1) for i in range(12)]
    out = explore_combination(trades, starting=Decimal("10000"), conditions={"setup": "sweep"})
    assert out["insufficient_sample"] is False
    assert out["metrics"]["n"] == 12


def test_mfe_mae_missing() -> None:
    trades = [_row(pnl=Decimal("10"), day=i + 1) for i in range(8)]
    behavior = build_behavior_quant(trades, starting=Decimal("10000"))
    assert behavior["mfe_mae"]["available"] is False


def test_mfe_mae_available() -> None:
    trades = [
        _row(pnl=Decimal("20"), mfe_r=Decimal("2"), mae_r=Decimal("0.5"), day=i + 1)
        for i in range(10)
    ]
    behavior = build_behavior_quant(trades, starting=Decimal("10000"))
    assert behavior["mfe_mae"]["available"] is True
    assert behavior["mfe_mae"]["mfe_capture"]["median_pct"] is not None


def test_builder_includes_behavior() -> None:
    trades = [_row(pnl=Decimal("10"), day=i + 1) for i in range(15)]
    lab = build_quant_lab(trades, starting=Decimal("10000"))
    assert "behavior" in lab
    assert "discipline" in lab["behavior"]
