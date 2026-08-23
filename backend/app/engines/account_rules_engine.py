"""Account-rule evaluation at trade submission time.

Enforcement modes:
- warn: persist the trade, emit a risk event
- confirm: require acknowledged_warnings = true
- block: reject the trade
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.core.enums import EnforcementMode, RiskEventType, RiskStatus
from app.core.exceptions import PolicyViolation
from app.engines.risk_engine import (
    RiskEventDraft,
    RiskProfileView,
    RiskSnapshot,
    planned_risk_warning,
)


@dataclass
class SubmissionDecision:
    allowed: bool
    requires_confirmation: bool
    warnings: list[RiskEventDraft]
    block_reason: str | None = None


def evaluate_submission(
    *,
    planned_risk: Decimal,
    planned_rr: Decimal | None,
    profile: RiskProfileView,
    snapshot: RiskSnapshot,
    enforcement: EnforcementMode,
    acknowledged: bool,
    hard_enforcement: EnforcementMode = EnforcementMode.BLOCK,
) -> SubmissionDecision:
    warnings: list[RiskEventDraft] = []
    risk_warn = planned_risk_warning(planned_risk, profile)
    if risk_warn:
        warnings.append(risk_warn)

    if planned_rr is not None and planned_rr < profile.preferred_min_rr:
        warnings.append(
            RiskEventDraft(
                event_type=RiskEventType.RR_BELOW_MINIMUM,
                severity=RiskStatus.YELLOW,
                message=(
                    f"WARNING: Planned R:R is {planned_rr}. "
                    f"Configured minimum is {profile.preferred_min_rr}."
                ),
                metric_value=planned_rr,
                threshold_value=profile.preferred_min_rr,
            )
        )

    # Carry forward live snapshot reds that should halt new risk
    halt_types = {
        "daily_loss_exceeded",
        "firm_daily_drawdown_exceeded",
        "personal_drawdown_exceeded",
        "firm_max_drawdown_exceeded",
    }
    for event in snapshot.events:
        if event.event_type.value in halt_types:
            warnings.append(event)

    blocked = [w for w in warnings if w.event_type.value == "risk_per_trade_hard_block"]
    if blocked:
        if hard_enforcement == EnforcementMode.BLOCK:
            return SubmissionDecision(
                allowed=False,
                requires_confirmation=False,
                warnings=warnings,
                block_reason=blocked[0].message,
            )
        if hard_enforcement == EnforcementMode.CONFIRM and not acknowledged:
            return SubmissionDecision(
                allowed=False,
                requires_confirmation=True,
                warnings=warnings,
                block_reason=blocked[0].message,
            )

    reds = [w for w in warnings if w.severity == RiskStatus.RED and w.event_type.value in halt_types]
    if reds:
        return SubmissionDecision(
            allowed=False,
            requires_confirmation=False,
            warnings=warnings,
            block_reason=reds[0].message,
        )

    over_unit = any(w.event_type.value == "risk_per_trade_exceeded" for w in warnings)
    if over_unit:
        if enforcement == EnforcementMode.BLOCK:
            return SubmissionDecision(
                allowed=False,
                requires_confirmation=False,
                warnings=warnings,
                block_reason=warnings[0].message,
            )
        if enforcement == EnforcementMode.CONFIRM and not acknowledged:
            return SubmissionDecision(
                allowed=False,
                requires_confirmation=True,
                warnings=warnings,
            )

    return SubmissionDecision(allowed=True, requires_confirmation=False, warnings=warnings)


def raise_if_blocked(decision: SubmissionDecision) -> None:
    if decision.allowed:
        return
    if decision.requires_confirmation:
        raise PolicyViolation(
            decision.block_reason
            or "Planned risk exceeds policy. Set acknowledged_warnings=true to journal this trade anyway.",
            code="policy_confirmation_required",
        )
    raise PolicyViolation(decision.block_reason or "Trade blocked by account policy.", code="policy_blocked")
