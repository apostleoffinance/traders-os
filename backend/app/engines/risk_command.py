"""Risk Command — radar score, trading capacity, and prop survival gauges."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.core.enums import RiskStatus
from app.engines.command_center import _trading_capacity
from app.engines.fx_math import ZERO, money
from app.engines.risk_engine import RiskProfileView, RiskSnapshot
from app.models.account import Account, AccountRiskProfile


def _gauge_row(limit: Decimal, used: Decimal, remaining: Decimal | None = None) -> dict[str, Any]:
    if remaining is None:
        remaining = max(limit - used, ZERO)
    pct = float(used / limit * 100) if limit > ZERO else 0.0
    return {
        "limit": money(limit),
        "used": money(used),
        "remaining": money(remaining),
        "used_pct": round(min(100.0, max(0.0, pct)), 1),
    }


def _radar_score(snap: RiskSnapshot, profile: RiskProfileView) -> tuple[int, str]:
    parts: list[float] = []

    if profile.personal_daily_loss_limit > ZERO:
        parts.append(
            float(min(Decimal("1"), snap.distance_to_personal_daily_loss / profile.personal_daily_loss_limit))
            * 100
        )
    if profile.personal_max_drawdown > ZERO:
        parts.append(
            float(min(Decimal("1"), snap.distance_to_personal_max_dd / profile.personal_max_drawdown)) * 100
        )
    if profile.max_trades_per_day > 0:
        remaining = max(0, profile.max_trades_per_day - snap.trades_today)
        parts.append(remaining / profile.max_trades_per_day * 100)

    score = int(round(sum(parts) / len(parts))) if parts else 50

    if snap.consecutive_losses >= 5:
        score -= 20
    elif snap.consecutive_losses >= 3:
        score -= 10
    if snap.risk_escalation_pct is not None and snap.risk_escalation_pct > Decimal("0.20"):
        score -= 10

    if snap.status == RiskStatus.RED:
        score = min(score, 25)
        label = "HALT"
    elif snap.status == RiskStatus.YELLOW:
        score = min(score, 60)
        label = "CAUTION"
    else:
        label = "HEALTHY" if score >= 70 else "CAUTION"

    return max(0, min(100, score)), label


def _survival_mode(
    account: Account,
    profile_model: AccountRiskProfile,
    snap: RiskSnapshot,
    starting: Decimal,
) -> dict[str, Any]:
    extra = profile_model.extra_restrictions or {}
    program_lower = account.program.lower()
    phase = str(extra.get("phase") or ("funded" if "funded" in program_lower else "challenge"))

    profit_target: Decimal | None = None
    if extra.get("profit_target") is not None:
        profit_target = Decimal(str(extra["profit_target"]))
    elif phase != "funded":
        profit_target = (starting * Decimal("0.10")).quantize(Decimal("0.01"))

    profit_earned = max(snap.total_pnl, ZERO)
    daily_loss_used = max(-snap.daily_pnl, ZERO) if snap.daily_pnl < ZERO else ZERO

    out: dict[str, Any] = {
        "firm": account.firm,
        "program": account.program,
        "account_name": account.account_name,
        "currency": account.currency,
        "starting_balance": money(starting),
        "equity": money(snap.current_equity),
        "phase": phase,
        "profit_target": None,
        "max_daily_loss": _gauge_row(
            Decimal(profile_model.firm_daily_drawdown_limit),
            daily_loss_used,
            snap.distance_to_firm_daily_dd,
        ),
        "max_drawdown": _gauge_row(
            Decimal(profile_model.firm_max_drawdown_limit),
            snap.current_drawdown,
            snap.distance_to_firm_max_dd,
        ),
    }

    if profit_target is not None and profit_target > ZERO:
        out["profit_target"] = _gauge_row(profit_target, profit_earned, max(profit_target - profit_earned, ZERO))

    return out


def build_risk_command(
    *,
    account: Account,
    profile_model: AccountRiskProfile,
    profile: RiskProfileView,
    snap: RiskSnapshot,
    starting: Decimal,
) -> dict[str, Any]:
    score, radar_label = _radar_score(snap, profile)
    daily_used = profile.personal_daily_loss_limit - snap.distance_to_personal_daily_loss
    if daily_used < ZERO:
        daily_used = ZERO
    firm_daily_used = max(-snap.daily_pnl, ZERO) if snap.daily_pnl < ZERO else ZERO

    return {
        "account": {
            "id": str(account.id),
            "name": account.account_name,
            "firm": account.firm,
            "program": account.program,
            "currency": account.currency,
        },
        "status": snap.status.value,
        "reasons": snap.reasons,
        "risk_radar": {
            "score": score,
            "label": radar_label,
            "gauges": {
                "daily_loss": _gauge_row(
                    profile.personal_daily_loss_limit,
                    daily_used,
                    snap.distance_to_personal_daily_loss,
                ),
                "drawdown": _gauge_row(
                    profile.personal_max_drawdown,
                    snap.current_drawdown,
                    snap.distance_to_personal_max_dd,
                ),
                "trades_today": {
                    "limit": str(profile.max_trades_per_day),
                    "used": str(snap.trades_today),
                    "remaining": str(max(0, profile.max_trades_per_day - snap.trades_today)),
                    "used_pct": round(
                        min(
                            100.0,
                            max(
                                0.0,
                                snap.trades_today / profile.max_trades_per_day * 100
                                if profile.max_trades_per_day > 0
                                else 0.0,
                            ),
                        ),
                        1,
                    ),
                },
            },
        },
        "trading_capacity": _trading_capacity(profile, snap),
        "survival_mode": _survival_mode(account, profile_model, snap, starting),
        "metrics": {
            "daily_pnl": money(snap.daily_pnl),
            "daily_risk": money(snap.daily_risk),
            "trades_today": snap.trades_today,
            "consecutive_losses": snap.consecutive_losses,
            "consecutive_wins": snap.consecutive_wins,
            "current_drawdown": money(snap.current_drawdown),
            "current_drawdown_pct": str(snap.current_drawdown_pct),
            "max_drawdown": money(snap.max_drawdown),
            "avg_risk_last_n": money(snap.avg_risk_last_n) if snap.avg_risk_last_n is not None else None,
            "risk_escalation_pct": str(snap.risk_escalation_pct)
            if snap.risk_escalation_pct is not None
            else None,
        },
        "limits": {
            "personal_daily_loss": _gauge_row(
                profile.personal_daily_loss_limit,
                daily_used,
                snap.distance_to_personal_daily_loss,
            ),
            "personal_max_drawdown": _gauge_row(
                profile.personal_max_drawdown,
                snap.current_drawdown,
                snap.distance_to_personal_max_dd,
            ),
            "firm_daily_loss": _gauge_row(
                profile.firm_daily_drawdown_limit,
                firm_daily_used,
                snap.distance_to_firm_daily_dd,
            ),
            "firm_max_drawdown": _gauge_row(
                profile.firm_max_drawdown_limit,
                snap.current_drawdown,
                snap.distance_to_firm_max_dd,
            ),
        },
        "events": [
            {
                "event_type": e.event_type.value,
                "severity": e.severity.value,
                "message": e.message,
                "metric_value": money(e.metric_value) if e.metric_value is not None else None,
                "threshold_value": money(e.threshold_value) if e.threshold_value is not None else None,
            }
            for e in snap.events
        ],
    }
