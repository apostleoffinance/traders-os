"""Policy status for calculator results. Pure — no DB."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.core.enums import RiskStatus
from app.engines.fx_math import ZERO, money


@dataclass(frozen=True)
class PolicyLimits:
    risk_per_trade: Decimal
    hard_risk_per_trade: Decimal | None
    preferred_min_rr: Decimal
    personal_daily_loss_limit: Decimal
    daily_risk_used: Decimal
    daily_pnl: Decimal
    equity: Decimal
    balance: Decimal
    distance_to_personal_daily_loss: Decimal
    distance_to_personal_max_dd: Decimal
    distance_to_firm_max_dd: Decimal
    snapshot_status: str


@dataclass
class PolicyAssessment:
    status: str  # green | yellow | red
    headline: str
    details: list[str]
    account: dict
    trade_risk: dict
    account_impact: dict

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "headline": self.headline,
            "details": self.details,
            "account": self.account,
            "trade_risk": self.trade_risk,
            "account_impact": self.account_impact,
        }


def assess_policy(
    *,
    limits: PolicyLimits,
    risk_amount: Decimal | None,
    reward_amount: Decimal | None,
    risk_percent: Decimal | None,
    planned_rr: Decimal | None,
) -> PolicyAssessment:
    risk = risk_amount or ZERO
    reward = reward_amount
    details: list[str] = []
    status = RiskStatus.GREEN.value

    if risk > ZERO and limits.hard_risk_per_trade is not None and risk > limits.hard_risk_per_trade:
        status = RiskStatus.RED.value
        details.append(
            f"Planned risk ${risk} exceeds hard maximum ${money(limits.hard_risk_per_trade)} per trade."
        )
    elif risk > ZERO and risk > limits.risk_per_trade:
        status = RiskStatus.RED.value
        details.append(
            f"Planned risk ${risk} exceeds your ${money(limits.risk_per_trade)} maximum risk per trade."
        )

    if planned_rr is not None and planned_rr < limits.preferred_min_rr:
        if status != RiskStatus.RED.value:
            status = RiskStatus.YELLOW.value
        details.append(
            f"Planned R:R {planned_rr} is below configured minimum {limits.preferred_min_rr}."
        )

    daily_remaining = money(max(ZERO, limits.risk_per_trade - limits.daily_risk_used))
    # Approaching daily capacity
    if (
        status == RiskStatus.GREEN.value
        and risk > ZERO
        and limits.daily_risk_used + risk > limits.risk_per_trade * Decimal("0.8")
        and limits.daily_risk_used + risk <= limits.risk_per_trade
    ):
        status = RiskStatus.YELLOW.value
        details.append("Risk is within policy but leaves limited daily risk capacity.")

    if risk > ZERO and limits.daily_risk_used + risk > limits.risk_per_trade and status != RiskStatus.RED.value:
        # Soft: daily risk budget (sum of planned risks today) — yellow unless already red
        status = RiskStatus.YELLOW.value
        details.append(
            f"This plan plus today's risk (${money(limits.daily_risk_used)}) exceeds your "
            f"${money(limits.risk_per_trade)} per-trade unit used as daily risk budget."
        )

    if limits.snapshot_status == RiskStatus.RED.value:
        status = RiskStatus.RED.value
        details.append("Account risk monitor is RED. Do not add new risk until limits reset.")
    elif limits.snapshot_status == RiskStatus.YELLOW.value and status == RiskStatus.GREEN.value:
        status = RiskStatus.YELLOW.value
        details.append("Account risk monitor is YELLOW. Capacity is limited.")

    if status == RiskStatus.GREEN.value:
        headline = (
            f"Within account policy — risk ${money(risk)} / ${money(limits.risk_per_trade)} maximum"
            if risk > ZERO
            else "Within account policy"
        )
    elif status == RiskStatus.YELLOW.value:
        headline = "Approaching a configured limit"
    else:
        headline = "Calculation exceeds configured risk limits"

    if not details and status == RiskStatus.GREEN.value:
        details.append("Based on your inputs and the selected account policy.")

    return PolicyAssessment(
        status=status,
        headline=headline,
        details=details,
        account={
            "balance": str(money(limits.balance)),
            "equity": str(money(limits.equity)),
        },
        trade_risk={
            "risk": str(money(risk)) if risk_amount is not None else None,
            "risk_percent": str(risk_percent) if risk_percent is not None else None,
            "potential_loss": str(money(risk)) if risk_amount is not None else None,
            "potential_gain": str(money(reward)) if reward is not None else None,
            "planned_rr": str(planned_rr) if planned_rr is not None else None,
        },
        account_impact={
            "daily_risk_used": str(money(limits.daily_risk_used)),
            "daily_risk_budget": str(money(limits.risk_per_trade)),
            "daily_risk_remaining": str(daily_remaining),
            "daily_pnl": str(money(limits.daily_pnl)),
            "max_dd_remaining_personal": str(money(limits.distance_to_personal_max_dd)),
            "max_dd_remaining_firm": str(money(limits.distance_to_firm_max_dd)),
            "daily_loss_remaining": str(money(limits.distance_to_personal_daily_loss)),
        },
    )
