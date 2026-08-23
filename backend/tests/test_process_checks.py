from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.enums import EnforcementMode, ProcessStatus
from app.engines.account_rules_engine import evaluate_submission
from app.engines.process_checks import evaluate_auto_checks, process_status
from app.engines.risk_engine import RiskProfileView, compute_risk_snapshot


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


def test_auto_checks_pass_inside_policy() -> None:
    now = datetime(2026, 3, 10, 10, tzinfo=ZoneInfo("Africa/Lagos"))
    snap = compute_risk_snapshot(
        starting_balance=Decimal("1000"),
        profile=_profile(),
        trades=[],
        now=now,
        timezone="Africa/Lagos",
    )
    checks = evaluate_auto_checks(
        planned_risk=Decimal("5.00"),
        planned_rr=Decimal("2.00"),
        stop_loss_set=True,
        take_profit_set=True,
        session="london",
        in_preferred_session=True,
        profile=_profile(),
        snapshot=snap,
    )
    by_key = {c.auto_key: c for c in checks}
    assert by_key["risk_per_trade"].passed is True
    assert "5.00" in by_key["risk_per_trade"].display
    assert by_key["planned_rr"].passed is True
    assert by_key["session"].passed is True
    assert by_key["trades_today"].display.startswith("Trades today: 0 / 2")


def test_hard_block_status_is_blocked() -> None:
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
    checks = evaluate_auto_checks(
        planned_risk=Decimal("12.00"),
        planned_rr=Decimal("2.00"),
        stop_loss_set=True,
        take_profit_set=True,
        session="london",
        in_preferred_session=True,
        profile=_profile(),
        snapshot=snap,
        hard_blocked=True,
    )
    assert process_status(decision, checks) == ProcessStatus.BLOCKED.value
    risk = next(c for c in checks if c.auto_key == "risk_per_trade")
    assert risk.status == ProcessStatus.BLOCKED.value
    assert risk.passed is False
