"""Format engine outputs as pre-trade automatic process checks.

Does not recompute P/L, R, session, or policy. Those stay in fx_math,
session_engine, risk_engine, and account_rules_engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.core.enums import AutoCheckKey, ProcessStatus, RiskStatus, SessionName
from app.engines.account_rules_engine import SubmissionDecision
from app.engines.fx_math import money
from app.engines.risk_engine import RiskProfileView, RiskSnapshot

SESSION_DISPLAY = {
    SessionName.ASIA.value: "Asia",
    SessionName.LONDON.value: "London",
    SessionName.NEW_YORK.value: "New York",
    SessionName.LONDON_NY_OVERLAP.value: "London/NY overlap",
    SessionName.OUTSIDE.value: "Outside session",
}


@dataclass(frozen=True)
class AutoCheck:
    auto_key: str
    label: str
    passed: bool
    status: str
    display: str
    value: Decimal | None = None
    threshold: Decimal | None = None


def _status(passed: bool, *, blocked: bool = False) -> str:
    if blocked:
        return ProcessStatus.BLOCKED.value
    if passed:
        return ProcessStatus.VALID.value
    return ProcessStatus.WARNING.value


def evaluate_auto_checks(
    *,
    planned_risk: Decimal,
    planned_rr: Decimal | None,
    stop_loss_set: bool,
    take_profit_set: bool,
    session: str,
    in_preferred_session: bool,
    profile: RiskProfileView,
    snapshot: RiskSnapshot,
    hard_blocked: bool = False,
) -> list[AutoCheck]:
    checks: list[AutoCheck] = []

    session_label = SESSION_DISPLAY.get(session, session)
    if session == SessionName.OUTSIDE.value:
        session_display = "Outside session"
        session_ok = False
    elif in_preferred_session:
        session_display = f"{session_label} — in preferred window"
        session_ok = True
    else:
        session_display = f"{session_label} — outside preferred window"
        session_ok = False
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.SESSION.value,
            label="Trading session",
            passed=session_ok,
            status=_status(session_ok),
            display=session_display,
        )
    )

    risk_ok = planned_risk <= profile.risk_per_trade
    if hard_blocked:
        checks.append(
            AutoCheck(
                auto_key=AutoCheckKey.RISK_PER_TRADE.value,
                label="Risk within configured maximum",
                passed=False,
                status=ProcessStatus.BLOCKED.value,
                display=(
                    f"BLOCKED — Risk: ${money(planned_risk)} / "
                    f"${money(profile.hard_risk_per_trade or profile.risk_per_trade)}"
                ),
                value=money(planned_risk),
                threshold=money(profile.hard_risk_per_trade or profile.risk_per_trade),
            )
        )
    else:
        checks.append(
            AutoCheck(
                auto_key=AutoCheckKey.RISK_PER_TRADE.value,
                label="Risk within configured maximum",
                passed=risk_ok,
                status=_status(risk_ok),
                display=f"Risk: ${money(planned_risk)} / ${money(profile.risk_per_trade)}",
                value=money(planned_risk),
                threshold=money(profile.risk_per_trade),
            )
        )

    if planned_rr is None:
        rr_ok = False
        rr_display = "R:R: — (no take-profit)"
        rr_value = None
    else:
        rr_ok = planned_rr >= profile.preferred_min_rr
        rr_display = f"R:R: 1:{planned_rr}"
        rr_value = planned_rr
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.PLANNED_RR.value,
            label="Planned R:R meets configured minimum",
            passed=rr_ok,
            status=_status(rr_ok),
            display=rr_display,
            value=rr_value,
            threshold=profile.preferred_min_rr,
        )
    )

    remaining_daily = snapshot.distance_to_personal_daily_loss
    daily_ok = remaining_daily >= planned_risk
    red_daily = any(
        e.severity == RiskStatus.RED and e.event_type.value == "daily_loss_exceeded" for e in snapshot.events
    )
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.DAILY_LOSS.value,
            label="Daily risk available",
            passed=daily_ok and not red_daily,
            status=_status(daily_ok and not red_daily, blocked=red_daily),
            display=f"Daily risk: ${money(planned_risk)} / ${money(remaining_daily)} available",
            value=money(planned_risk),
            threshold=money(remaining_daily),
        )
    )

    trades_ok = snapshot.trades_today < profile.max_trades_per_day
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.TRADES_TODAY.value,
            label="Trades today within limit",
            passed=trades_ok,
            status=_status(trades_ok),
            display=f"Trades today: {snapshot.trades_today} / {profile.max_trades_per_day}",
            value=Decimal(snapshot.trades_today),
            threshold=Decimal(profile.max_trades_per_day),
        )
    )

    dd_ok = snapshot.distance_to_personal_max_dd > 0
    red_dd = any(
        e.severity == RiskStatus.RED
        and e.event_type.value in {"personal_drawdown_exceeded", "firm_max_drawdown_exceeded"}
        for e in snapshot.events
    )
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.DRAWDOWN.value,
            label="Drawdown within limits",
            passed=dd_ok and not red_dd,
            status=_status(dd_ok and not red_dd, blocked=red_dd),
            display=(
                f"Drawdown: ${money(snapshot.current_drawdown)} / "
                f"${money(profile.personal_max_drawdown)}"
            ),
            value=money(snapshot.current_drawdown),
            threshold=money(profile.personal_max_drawdown),
        )
    )

    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.SL_DEFINED.value,
            label="Stop-loss defined",
            passed=stop_loss_set,
            status=_status(stop_loss_set),
            display="SL defined" if stop_loss_set else "SL missing",
        )
    )
    checks.append(
        AutoCheck(
            auto_key=AutoCheckKey.TP_DEFINED.value,
            label="Take-profit defined",
            passed=take_profit_set,
            status=_status(take_profit_set),
            display="TP defined" if take_profit_set else "TP not set",
        )
    )
    return checks


def process_status(decision: SubmissionDecision, checks: list[AutoCheck]) -> str:
    if not decision.allowed and not decision.requires_confirmation:
        return ProcessStatus.BLOCKED.value
    if any(c.status == ProcessStatus.BLOCKED.value for c in checks):
        return ProcessStatus.BLOCKED.value
    if decision.requires_confirmation:
        return ProcessStatus.WARNING.value
    if any(not c.passed for c in checks):
        return ProcessStatus.WARNING.value
    return ProcessStatus.VALID.value


def auto_check_to_dict(check: AutoCheck) -> dict:
    return {
        "auto_key": check.auto_key,
        "label": check.label,
        "passed": check.passed,
        "status": check.status,
        "display": check.display,
        "value": check.value,
        "threshold": check.threshold,
    }
