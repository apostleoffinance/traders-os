"""Tests for checklist item analytics and comparison lab."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.checklist_intel import build_checklist_item_analytics
from app.engines.analytics_lab.comparison_intel import ComparisonGroupSpec, compare_groups
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ChecklistItemSnapshot


def _row(
    *,
    pnl: Decimal,
    session: str = "london",
    discipline: int = 80,
    emotional: bool = False,
    items: tuple[ChecklistItemSnapshot, ...] = (),
) -> AnalyticsTrade:
    return AnalyticsTrade(
        id=f"t-{session}-{pnl}",
        symbol="EURUSD",
        direction="long",
        session=session,
        setup="sweep",
        setup_id="s1",
        timeframe="M15",
        entry_at=datetime(2026, 5, 1, 9, tzinfo=timezone.utc),
        exit_at=datetime(2026, 5, 1, 10, tzinfo=timezone.utc),
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.11"),
        lot_size=Decimal("0.1"),
        risk_amount=Decimal("10"),
        risk_percent=Decimal("1"),
        commission=Decimal("0"),
        swap=Decimal("0"),
        realized_pnl=pnl,
        realized_r=pnl / Decimal("10"),
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        emotion_before="calm",
        discipline_score=discipline,
        emotional_trade=emotional,
        checklist_items=items,
    )


def test_checklist_item_checked_vs_unchecked() -> None:
    item = ChecklistItemSnapshot(
        item_id="i1",
        label="Wait for structure confirmation",
        category="setup_confirmation",
        required=True,
        checked=True,
    )
    item_off = ChecklistItemSnapshot(
        item_id="i1",
        label="Wait for structure confirmation",
        category="setup_confirmation",
        required=True,
        checked=False,
    )
    trades = [
        _row(pnl=Decimal("20"), items=(item,)),
        _row(pnl=Decimal("10"), items=(item,)),
        _row(pnl=Decimal("-10"), items=(item_off,)),
    ]
    out = build_checklist_item_analytics(trades, starting=Decimal("1000"))
    assert len(out["items"]) == 1
    assert out["items"][0]["checked"]["n"] == 2
    assert out["items"][0]["unchecked"]["n"] == 1


def test_comparison_groups_london_vs_ny() -> None:
    trades = [
        _row(pnl=Decimal("20"), session="london"),
        _row(pnl=Decimal("10"), session="london"),
        _row(pnl=Decimal("-10"), session="new_york"),
        _row(pnl=Decimal("-5"), session="new_york"),
    ]
    result = compare_groups(
        trades,
        ComparisonGroupSpec(label="London", session="london"),
        ComparisonGroupSpec(label="New York", session="new_york"),
        starting=Decimal("1000"),
    )
    assert result["group_a"]["n"] == 2
    assert result["group_b"]["n"] == 2
    assert result["group_a"]["label"] == "London"


def test_ai_context_includes_intelligence_lab() -> None:
    from app.engines.analytics_lab.intelligence import intelligence_ai_summary

    trades = [_row(pnl=Decimal("10")) for _ in range(10)]
    summary = intelligence_ai_summary(trades, starting=Decimal("1000"), configured_risk=Decimal("10"))
    assert "insights" in summary
    assert "note" in summary
    assert summary["metadata"]["sample_size"] == 10
