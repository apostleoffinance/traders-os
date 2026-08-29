"""Unit tests for Risk Command engine."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.core.enums import RiskStatus
from app.engines.risk_command import build_risk_command
from app.engines.risk_engine import RiskProfileView, RiskSnapshot


def _snap(**kwargs) -> RiskSnapshot:
    base = dict(
        status=RiskStatus.GREEN,
        reasons=[],
        current_balance=Decimal("1080"),
        current_equity=Decimal("1080"),
        starting_balance=Decimal("1000"),
        total_pnl=Decimal("80"),
        daily_pnl=Decimal("-20"),
        daily_risk=Decimal("10"),
        current_drawdown=Decimal("30"),
        current_drawdown_pct=Decimal("3"),
        max_drawdown=Decimal("50"),
        max_drawdown_pct=Decimal("5"),
        high_water_mark=Decimal("1100"),
        drawdown_from_start=Decimal("0"),
        consecutive_losses=1,
        consecutive_wins=0,
        trades_today=1,
        distance_to_personal_daily_loss=Decimal("8"),
        distance_to_personal_max_dd=Decimal("70"),
        distance_to_firm_daily_dd=Decimal("40"),
        distance_to_firm_max_dd=Decimal("60"),
        avg_risk_last_n=Decimal("5"),
        risk_escalation_pct=None,
        equity_curve=[],
        events=[],
    )
    base.update(kwargs)
    return RiskSnapshot(**base)


def _account():
    return SimpleNamespace(
        id=uuid4(),
        firm="FTMO",
        program="Challenge $10K",
        account_name="FTMO 10K",
        currency="USD",
    )


def _profile_model():
    return SimpleNamespace(
        firm_daily_drawdown_limit=Decimal("500"),
        firm_max_drawdown_limit=Decimal("1000"),
        extra_restrictions={"profit_target": "1000"},
    )


def test_risk_command_includes_radar_and_capacity():
    profile = RiskProfileView(
        risk_per_trade=Decimal("50"),
        personal_daily_loss_limit=Decimal("100"),
        personal_max_drawdown=Decimal("500"),
        firm_daily_drawdown_limit=Decimal("500"),
        firm_max_drawdown_limit=Decimal("1000"),
        max_trades_per_day=5,
        preferred_min_rr=Decimal("1.5"),
    )
    out = build_risk_command(
        account=_account(),
        profile_model=_profile_model(),
        profile=profile,
        snap=_snap(),
        starting=Decimal("10000"),
    )
    assert 0 <= out["risk_radar"]["score"] <= 100
    assert out["risk_radar"]["label"] in {"HEALTHY", "CAUTION", "HALT"}
    assert out["trading_capacity"]["full_risk_trades_remaining"] == 0  # 8 remaining / 50 risk
    assert out["survival_mode"]["firm"] == "FTMO"
    assert out["survival_mode"]["profit_target"]["limit"] == Decimal("1000.00")
    assert out["survival_mode"]["max_daily_loss"]["used"] == Decimal("20.00")


def test_risk_command_halt_caps_radar():
    profile = RiskProfileView(
        risk_per_trade=Decimal("50"),
        personal_daily_loss_limit=Decimal("100"),
        personal_max_drawdown=Decimal("500"),
        firm_daily_drawdown_limit=Decimal("500"),
        firm_max_drawdown_limit=Decimal("1000"),
        max_trades_per_day=5,
        preferred_min_rr=Decimal("1.5"),
    )
    out = build_risk_command(
        account=_account(),
        profile_model=_profile_model(),
        profile=profile,
        snap=_snap(status=RiskStatus.RED, reasons=["Daily loss limit reached"]),
        starting=Decimal("10000"),
    )
    assert out["risk_radar"]["label"] == "HALT"
    assert out["risk_radar"]["score"] <= 25
