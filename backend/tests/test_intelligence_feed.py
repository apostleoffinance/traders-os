"""Unit tests for Intelligence Feed v2."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.core.enums import RiskStatus, TradeResult, TradeStatus
from app.engines.analytics_views import JournalTrade
from app.engines.intelligence_feed import build_intelligence_feed
from app.engines.risk_engine import ClosedTrade, RiskProfileView, RiskSnapshot


def _journal(**kwargs) -> JournalTrade:
    base = dict(
        id=str(uuid4()),
        symbol="EURUSD",
        session="london",
        setup="Sweep",
        direction="long",
        timeframe="M15",
        result=TradeResult.WIN,
        status=TradeStatus.CLOSED,
        entry_at=datetime(2026, 3, 1, 8, 0, tzinfo=timezone.utc),
        exit_at=datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc),
        risk_amount=Decimal("5"),
        risk_percent=Decimal("0.5"),
        realized_pnl=Decimal("10"),
        realized_r=Decimal("2"),
        holding_time_seconds=7200,
        emotion_before="calm",
        discipline_score=85,
    )
    base.update(kwargs)
    return JournalTrade(**base)


def _snap(**kwargs) -> RiskSnapshot:
    base = dict(
        status=RiskStatus.GREEN,
        reasons=[],
        current_balance=Decimal("1100"),
        current_equity=Decimal("1100"),
        starting_balance=Decimal("1000"),
        total_pnl=Decimal("100"),
        daily_pnl=Decimal("20"),
        daily_risk=Decimal("5"),
        current_drawdown=Decimal("10"),
        current_drawdown_pct=Decimal("1"),
        max_drawdown=Decimal("30"),
        max_drawdown_pct=Decimal("3"),
        high_water_mark=Decimal("1100"),
        drawdown_from_start=Decimal("0"),
        consecutive_losses=0,
        consecutive_wins=2,
        trades_today=1,
        distance_to_personal_daily_loss=Decimal("80"),
        distance_to_firm_daily_dd=Decimal("400"),
        distance_to_personal_max_dd=Decimal("90"),
        distance_to_firm_max_dd=Decimal("900"),
        avg_risk_last_n=Decimal("5"),
        risk_escalation_pct=None,
        equity_curve=[],
        events=[],
    )
    base.update(kwargs)
    return RiskSnapshot(**base)


def _profile() -> RiskProfileView:
    return RiskProfileView(
        risk_per_trade=Decimal("50"),
        personal_daily_loss_limit=Decimal("100"),
        personal_max_drawdown=Decimal("500"),
        firm_daily_drawdown_limit=Decimal("500"),
        firm_max_drawdown_limit=Decimal("1000"),
        max_trades_per_day=5,
        preferred_min_rr=Decimal("1.5"),
    )


def test_feed_includes_today_and_edge():
    rows = [_journal(session="london") for _ in range(6)] + [
        _journal(session="new_york", result=TradeResult.LOSS, realized_r=Decimal("-1"), realized_pnl=Decimal("-5"))
        for _ in range(6)
    ]
    closed = [
        ClosedTrade(
            id=r.id,
            entry_at=r.entry_at,
            exit_at=r.exit_at,
            risk_amount=r.risk_amount,
            realized_pnl=r.realized_pnl,
            result=r.result,
            status=r.status,
        )
        for r in rows
    ]
    out = build_intelligence_feed(
        rows,
        closed,
        _snap(),
        _profile(),
        Decimal("1000"),
        today_journal=[rows[0]],
    )
    assert len(out["today"]) >= 1
    assert any(i["type"] == "EDGE" for i in out["insights"])
    assert all("why" in i and "action" in i for i in out["insights"])


def test_feed_risk_halt():
    out = build_intelligence_feed([], [], _snap(status=RiskStatus.RED, reasons=["Halt"]), _profile(), Decimal("1000"))
    assert out["insights"][0]["severity"] == "danger"
    assert out["insights"][0]["id"] == "risk-halt"
