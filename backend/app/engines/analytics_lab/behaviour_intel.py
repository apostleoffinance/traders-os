"""Behavioural Intelligence Engine — deterministic, non-causal."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.features import extract_contexts
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows, ordered_closed
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ZERO, money, ratio


def _avg(xs: list[Decimal]) -> Decimal | None:
    return sum(xs, ZERO) / Decimal(len(xs)) if xs else None


def _state_metrics(trades: list[AnalyticsTrade], starting: Decimal) -> dict:
    if not trades:
        return {"n": 0, "win_rate": None, "average_r": None, "avg_risk": None}
    journals = journal_rows(trades)
    row = dump_perf_group("state", journals, starting, "State")
    risks = [t.risk_amount for t in trades if t.risk_amount > ZERO]
    return {
        "n": row["n"],
        "win_rate": row["win_rate"],
        "average_r": row["average_r"],
        "expectancy_r": row["expectancy_r"],
        "net_pnl": row["net_pnl"],
        "avg_risk": money(_avg(risks)) if risks else None,
    }


def build_behaviour_intelligence(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    configured_risk: Decimal | None,
) -> dict:
    closed = ordered_closed(trades)
    n = len(closed)
    conf = confidence_payload(n, metric="Behavioural intelligence")

    contexts = extract_contexts(trades)
    baseline_risks = [t.risk_amount for t in closed if t.risk_amount > ZERO]
    baseline_risk = _avg(baseline_risks)

    after_loss = [c.trade for c in contexts if c.prev_outcome == "loss"]
    after_win = [c.trade for c in contexts if c.prev_outcome == "win"]
    revenge = [c.trade for c in contexts if c.is_revenge_candidate]

    after_loss_risks = [t.risk_amount for t in after_loss if t.risk_amount > ZERO]
    after_win_risks = [t.risk_amount for t in after_win if t.risk_amount > ZERO]
    avg_after_loss = _avg(after_loss_risks)
    avg_after_win = _avg(after_win_risks)

    risk_mult_after_loss = None
    if baseline_risk and baseline_risk > ZERO and avg_after_loss is not None:
        risk_mult_after_loss = ratio((avg_after_loss - baseline_risk) / baseline_risk * Decimal("100"))

    risk_mult_after_win = None
    if baseline_risk and baseline_risk > ZERO and avg_after_win is not None:
        risk_mult_after_win = ratio((avg_after_win - baseline_risk) / baseline_risk * Decimal("100"))

    # Loss state table: baseline, after 1/2/3 losses
    loss_states: list[dict] = []
    baseline_trades = [c.trade for c in contexts if c.consecutive_losses_before == 0]
    loss_states.append({"state": "Baseline", **_state_metrics(baseline_trades, starting)})
    for losses in (1, 2, 3):
        bucket = [c.trade for c in contexts if c.consecutive_losses_before == losses]
        loss_states.append({"state": f"After {losses} loss{'es' if losses > 1 else ''}", **_state_metrics(bucket, starting)})

    # Win streak behaviour
    win_states: list[dict] = []
    win_states.append({"state": "Baseline", **_state_metrics(baseline_trades, starting)})
    for wins in (1, 2, 3):
        bucket = [c.trade for c in contexts if c.consecutive_wins_before == wins]
        win_states.append({"state": f"After {wins} win{'s' if wins > 1 else ''}", **_state_metrics(bucket, starting)})

    # Overtrading baseline
    from collections import defaultdict as dd
    from zoneinfo import ZoneInfo
    from app.core.time import as_utc

    by_day: dict = dd(int)
    for t in closed:
        day = as_utc(t.exit_at or t.entry_at).date()
        by_day[day] += 1
    daily_counts = list(by_day.values())
    normal_trades_per_day = sum(daily_counts) / len(daily_counts) if daily_counts else 0

    rapid_followups = sum(1 for c in contexts if c.is_rapid_followup)

    return {
        "revenge_trading": {
            "revenge_trade_count": len(revenge),
            "revenge_trade_rate": ratio(Decimal(len(revenge)) / Decimal(n) * Decimal("100")) if n else None,
            "post_loss_trade_count": len(after_loss),
            "average_risk_after_loss": money(avg_after_loss) if avg_after_loss is not None else None,
            "average_risk_after_win": money(avg_after_win) if avg_after_win is not None else None,
            "baseline_risk": money(baseline_risk) if baseline_risk else money(configured_risk) if configured_risk else None,
            "risk_multiplier_after_loss_pct": risk_mult_after_loss,
            "risk_multiplier_after_win_pct": risk_mult_after_win,
            "rapid_followup_count": rapid_followups,
            "classification_rules": [
                f"Rapid follow-up: ≤{30} minutes after prior trade",
                f"Risk escalation: ≥{REVENGE_RISK_MULTIPLIER}× personal baseline",
                "Emotional/revenge flags from psychology fields",
            ],
            "disclaimer": "Revenge classification is rules-based and descriptive. Not all post-loss trades are revenge trades.",
            "confidence": confidence_payload(len(after_loss), metric="Post-loss behaviour"),
        },
        "loss_streak_behaviour": {
            "states": loss_states,
            "disclaimer": "Historical association only — not causal.",
            "confidence": conf,
        },
        "win_streak_behaviour": {
            "states": win_states,
            "disclaimer": "Historical association only — not causal.",
            "confidence": conf,
        },
        "overtrading": {
            "normal_trades_per_day": ratio(Decimal(str(normal_trades_per_day))) if daily_counts else None,
            "trading_days": len(daily_counts),
            "max_trades_in_day": max(daily_counts) if daily_counts else 0,
            "rapid_followup_trades": rapid_followups,
            "status": (
                "ELEVATED"
                if daily_counts and max(daily_counts) > normal_trades_per_day * 2
                else "NORMAL"
            ),
            "disclaimer": "Compared against your own historical daily trade frequency.",
            "confidence": confidence_payload(len(daily_counts), metric="Overtrading"),
        },
        "confidence": conf,
        "sample_size": n,
    }


# Import for classification rules display
from app.engines.analytics_lab.features import REVENGE_RISK_MULTIPLIER  # noqa: E402
