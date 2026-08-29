"""Unit tests for Command Center deterministic narratives."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.core.enums import RiskStatus, TradeResult, TradeStatus
from app.engines.command_center import build_command_center
from app.engines.risk_engine import ClosedTrade, RiskProfileView, RiskSnapshot
from app.models.trade import Trade


def _snap(**kwargs) -> RiskSnapshot:
    base = dict(
        status=RiskStatus.GREEN,
        reasons=[],
        current_balance=Decimal("1000"),
        current_equity=Decimal("1000"),
        starting_balance=Decimal("1000"),
        total_pnl=Decimal("0"),
        daily_pnl=Decimal("0"),
        daily_risk=Decimal("0"),
        current_drawdown=Decimal("0"),
        current_drawdown_pct=Decimal("0"),
        max_drawdown=Decimal("0"),
        max_drawdown_pct=Decimal("0"),
        high_water_mark=Decimal("1000"),
        drawdown_from_start=Decimal("0"),
        consecutive_losses=0,
        consecutive_wins=0,
        trades_today=0,
        distance_to_personal_daily_loss=Decimal("10"),
        distance_to_personal_max_dd=Decimal("50"),
        distance_to_firm_daily_dd=Decimal("60"),
        distance_to_firm_max_dd=Decimal("90"),
        avg_risk_last_n=None,
        risk_escalation_pct=None,
        equity_curve=[],
        events=[],
    )
    base.update(kwargs)
    return RiskSnapshot(**base)


def test_command_center_empty_day():
    profile = RiskProfileView(
        risk_per_trade=Decimal("5"),
        personal_daily_loss_limit=Decimal("10"),
        personal_max_drawdown=Decimal("50"),
        firm_daily_drawdown_limit=Decimal("60"),
        firm_max_drawdown_limit=Decimal("90"),
        max_trades_per_day=2,
        preferred_min_rr=Decimal("1.5"),
    )
    now = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)
    out = build_command_center(
        trades=[],
        journal=[],
        closed_views=[],
        snap=_snap(),
        profile=profile,
        starting=Decimal("1000"),
        timezone="UTC",
        now=now,
        perf_n=0,
    )
    assert out["account_status"] == "STABLE"
    assert out["today_story"]["trade_count"] == 0
    assert out["trading_capacity"]["full_risk_trades_remaining"] == 2
