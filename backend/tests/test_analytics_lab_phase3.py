"""Analytics Lab Phase 3 — behavioural & playbook intelligence."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.builder import build_analytics_lab
from app.engines.analytics_lab.confidence import ConfidenceLevel, classify_confidence
from app.engines.analytics_lab.decision_quality import build_decision_quality
from app.engines.analytics_lab.intelligence import build_intelligence_lab
from app.engines.analytics_lab.statistics import bootstrap_ci
from app.engines.analytics_lab.trade_row import AnalyticsTrade


def _row(
    *,
    pnl: Decimal,
    risk: Decimal = Decimal("10"),
    discipline: int | None = 70,
    emotional: bool = False,
    rules_followed: bool = True,
    setup_valid: bool = True,
    emotion_before: str = "calm",
    checklist_checked: int = 5,
    checklist_total: int = 5,
    exit_day: int = 1,
) -> AnalyticsTrade:
    entry = datetime(2026, 4, exit_day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 4, exit_day, 10, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{exit_day}-{pnl}",
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
        risk_amount=risk,
        risk_percent=Decimal("1"),
        commission=Decimal("0"),
        swap=Decimal("0"),
        realized_pnl=pnl,
        realized_r=pnl / risk if risk > 0 else None,
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS if pnl < 0 else TradeResult.BREAKEVEN,
        status=TradeStatus.CLOSED,
        emotion_before=emotion_before,
        discipline_score=discipline,
        rules_followed=rules_followed,
        emotional_trade=emotional,
        setup_valid=setup_valid,
        checklist_checked=checklist_checked,
        checklist_total=checklist_total,
    )


def test_decision_quality_good_loss_and_lucky_win() -> None:
    good_loss = _row(pnl=Decimal("-10"), discipline=90, rules_followed=True, setup_valid=True)
    lucky_win = _row(pnl=Decimal("20"), discipline=30, rules_followed=False, emotional=True, setup_valid=False)
    dq = build_decision_quality([good_loss, lucky_win])
    assert dq["counts"]["good_loss"] == 1
    assert dq["counts"]["lucky_win"] == 1


def test_confidence_insufficient_for_small_sample() -> None:
    assert classify_confidence(3) == ConfidenceLevel.INSUFFICIENT
    assert classify_confidence(10) == ConfidenceLevel.LOW
    assert classify_confidence(25) == ConfidenceLevel.MODERATE
    assert classify_confidence(60) == ConfidenceLevel.HIGH


def test_bootstrap_ci_deterministic() -> None:
    vals = [Decimal("1"), Decimal("2"), Decimal("-1"), Decimal("3"), Decimal("0")]
    a = bootstrap_ci(vals)
    b = bootstrap_ci(vals)
    assert a == b
    assert a["available"] is True


def test_intelligence_lab_insights_require_sample() -> None:
    trades = [_row(pnl=Decimal("10"), exit_day=i + 1) for i in range(3)]
    lab = build_intelligence_lab(trades, starting=Decimal("1000"), configured_risk=Decimal("10"))
    assert lab["metadata"]["sample_size"] == 3
    assert all(i["sample_size"] >= 5 or i["confidence"] == "insufficient" for i in lab["insights"]) or len(lab["insights"]) == 0


def test_builder_includes_intelligence() -> None:
    from types import SimpleNamespace

    trade = SimpleNamespace(
        id="x",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup=SimpleNamespace(name="sweep"),
        setup_id="s1",
        timeframe="M15",
        trade_timestamp=datetime(2026, 3, 1, 9, tzinfo=timezone.utc),
        exit_timestamp=datetime(2026, 3, 1, 10, tzinfo=timezone.utc),
        entry_price="1.1",
        exit_price="1.11",
        lot_size="0.1",
        risk_amount="10",
        risk_percent="1",
        commission="0",
        swap="0",
        realized_pnl="10",
        realized_r="1",
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN,
        status=TradeStatus.CLOSED,
        psychology=SimpleNamespace(
            emotion_before="calm",
            emotion_during=None,
            emotion_after=None,
            fomo=0,
            fear=0,
            frustration=0,
            revenge=0,
            boredom=0,
            confidence=5,
        ),
        discipline_score=85,
        setup_valid=True,
        rules_followed=True,
        emotional_trade=False,
        mistake=False,
        in_preferred_session=True,
        checklist_responses=[],
    )
    lab = build_analytics_lab([trade], starting=Decimal("1000"), timezone="UTC", filters={}, period="all")
    assert "intelligence" in lab
