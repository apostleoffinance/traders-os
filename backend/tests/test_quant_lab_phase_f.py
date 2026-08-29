"""Quant Lab Phase F — research intelligence tests."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.builder import build_quant_lab
from app.engines.quant_lab.quant_intelligence import quant_ai_summary
from app.engines.quant_lab.research_opportunities import generate_research_opportunities
from app.engines.quant_lab.walk_forward import build_walk_forward


def _row(*, pnl: Decimal, day: int) -> AnalyticsTrade:
    entry = datetime(2026, 1, day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 1, day, 10, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{day}",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup="sweep",
        setup_id="s1",
        timeframe="M15",
        entry_at=entry,
        exit_at=exit_at,
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
        emotion_before=None,
        rules_followed=True,
        emotional_trade=False,
        checklist_checked=0,
        checklist_total=0,
    )


def test_edge_confidence_exposes_components() -> None:
    trades = [_row(pnl=Decimal(str(10 + i)), day=i) for i in range(1, 21)]
    lab = build_quant_lab(trades, starting=Decimal("10000"))
    ec = lab["edge_confidence"]
    assert 0 <= ec["score"] <= 100
    assert "sample_adequacy" in ec["components"]
    assert ec["category"] == "STATISTICAL_CONFIDENCE"


def test_walk_forward_splits_sample() -> None:
    trades = [_row(pnl=Decimal("10"), day=i) for i in range(1, 11)]
    wf = build_walk_forward(trades, starting=Decimal("10000"), split_ratio=0.7)
    assert wf["label"] == "HISTORICAL PERIOD COMPARISON"
    assert wf["in_sample"]["n"] == 7
    assert wf["out_of_sample"]["n"] == 3


def test_research_opportunities_sample_warning() -> None:
    trades = [_row(pnl=Decimal("5"), day=i) for i in range(1, 6)]
    lab = build_quant_lab(trades, starting=Decimal("10000"))
    opps = generate_research_opportunities(
        sample_size=5,
        expectancy_r=lab["edge"]["expectancy"]["expectancy_r"],
        edge_stability=lab["edge"]["edge_stability"],
        outliers=lab["outliers"],
        behavior=lab["behavior"],
        setup_interactions=lab["behavior"]["setup_interactions"],
        edge_confidence=lab["edge_confidence"],
    )
    assert any(o["type"] == "SAMPLE_WARNING" for o in opps)


def test_quant_ai_summary_compact() -> None:
    trades = [_row(pnl=Decimal("12"), day=i) for i in range(1, 16)]
    summary = quant_ai_summary(trades, starting=Decimal("10000"))
    assert summary["expectancy"]["n"] == 15
    assert "research_opportunities" in summary
    assert summary["note"]


def test_full_lab_includes_research_sections() -> None:
    trades = [_row(pnl=Decimal("8"), day=i) for i in range(1, 26)]
    lab = build_quant_lab(trades, starting=Decimal("10000"))
    assert "research" in lab
    assert "edge_confidence" in lab
    assert "walk_forward" in lab
    assert lab["research"]["count"] >= 0
