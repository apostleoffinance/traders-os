from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.enums import EnforcementMode, RiskStatus
from app.core.exceptions import PolicyViolation
from app.engines.account_rules_engine import evaluate_submission, raise_if_blocked
from app.engines.risk_engine import ClosedTrade, RiskProfileView, compute_risk_snapshot, planned_risk_warning
from app.core.enums import TradeResult, TradeStatus


def _profile() -> RiskProfileView:
    return RiskProfileView(
        risk_per_trade=Decimal("5.00"),
        personal_daily_loss_limit=Decimal("10.00"),
        personal_max_drawdown=Decimal("50.00"),
        firm_daily_drawdown_limit=Decimal("60.00"),
        firm_max_drawdown_limit=Decimal("90.00"),
        max_trades_per_day=2,
        preferred_min_rr=Decimal("1.50"),
        hard_risk_per_trade=Decimal("10.00"),
    )


def test_planned_risk_warning_message() -> None:
    w = planned_risk_warning(Decimal("8.20"), _profile())
    assert w is not None
    assert "8.20" in w.message
    assert "5.00" in w.message


def test_confirm_mode_requires_ack() -> None:
    now = datetime(2026, 3, 10, 10, tzinfo=ZoneInfo("Africa/Lagos"))
    snap = compute_risk_snapshot(
        starting_balance=Decimal("1000"),
        profile=_profile(),
        trades=[],
        now=now,
        timezone="Africa/Lagos",
    )
    decision = evaluate_submission(
        planned_risk=Decimal("8.20"),
        planned_rr=Decimal("2.00"),
        profile=_profile(),
        snapshot=snap,
        enforcement=EnforcementMode.CONFIRM,
        acknowledged=False,
    )
    assert decision.allowed is False
    assert decision.requires_confirmation is True
    try:
        raise_if_blocked(decision)
        raise AssertionError("expected PolicyViolation")
    except PolicyViolation as exc:
        assert exc.code == "policy_confirmation_required"


def test_hard_limit_blocks() -> None:
    now = datetime(2026, 3, 10, 10, tzinfo=ZoneInfo("Africa/Lagos"))
    snap = compute_risk_snapshot(
        starting_balance=Decimal("1000"),
        profile=_profile(),
        trades=[],
        now=now,
        timezone="Africa/Lagos",
    )
    decision = evaluate_submission(
        planned_risk=Decimal("12.00"),
        planned_rr=Decimal("2.00"),
        profile=_profile(),
        snapshot=snap,
        enforcement=EnforcementMode.CONFIRM,
        acknowledged=True,
        hard_enforcement=EnforcementMode.BLOCK,
    )
    assert decision.allowed is False
    assert decision.requires_confirmation is False
