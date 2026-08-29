"""Behavior + quant interaction research for Quant Lab."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Callable, Sequence

from app.core.enums import TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows, ordered_closed
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import compute_performance
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.sample_policy import sample_payload
from app.engines.risk_engine import ClosedTrade

COMBINATION_MIN_N = 10


def _perf_row(trades: Sequence[AnalyticsTrade], *, starting: Decimal, label: str) -> dict:
    row = dump_perf_group(label, journal_rows(trades), starting, label)
    return {
        "n": row["n"],
        "win_rate": row["win_rate"],
        "expectancy_r": row["expectancy_r"],
        "profit_factor": row["profit_factor"],
        "average_r": row["average_r"],
        "net_pnl": row["net_pnl"],
    }


def _discipline_alpha(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    split_fn_a: Callable[[AnalyticsTrade], bool],
    label_a: str,
    label_b: str,
) -> dict:
    closed = closed_trades(list(trades))
    group_a = [t for t in closed if split_fn_a(t)]
    group_b = [t for t in closed if not split_fn_a(t)]
    ma = _perf_row(group_a, starting=starting, label=label_a)
    mb = _perf_row(group_b, starting=starting, label=label_b)
    diff_r = None
    if ma["expectancy_r"] is not None and mb["expectancy_r"] is not None:
        diff_r = ratio(Decimal(str(ma["expectancy_r"])) - Decimal(str(mb["expectancy_r"])))
    return {
        "label_a": label_a,
        "label_b": label_b,
        "group_a": ma,
        "group_b": mb,
        "discipline_alpha_r": diff_r,
        "label": "Observed Discipline Performance Difference",
        "disclaimer": "Observed difference in historical samples — not proof of causation.",
    }


def build_discipline_comparisons(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    def _confirmed(t: AnalyticsTrade) -> bool:
        return t.checklist_total > 0 and t.checklist_checked >= t.checklist_total

    comparisons = {
        "rules_followed_vs_broken": _discipline_alpha(
            trades,
            starting=starting,
            split_fn_a=lambda t: t.rules_followed,
            label_a="Rules followed",
            label_b="Rules broken",
        ),
        "non_emotional_vs_emotional": _discipline_alpha(
            trades,
            starting=starting,
            split_fn_a=lambda t: not t.emotional_trade,
            label_a="Non-emotional",
            label_b="Emotional",
        ),
        "with_confirmation_vs_without": _discipline_alpha(
            [t for t in closed if t.checklist_total > 0],
            starting=starting,
            split_fn_a=_confirmed,
            label_a="With confirmation (checklist complete)",
            label_b="Without confirmation",
        ),
    }
    return {
        "comparisons": comparisons,
        "sample": sample_payload(len(closed)),
        "category": "OBSERVED_PERFORMANCE",
    }


def _risk_stats(values: list[Decimal]) -> dict:
    if not values:
        return {"average": None, "median": None, "n": 0}
    return {
        "average": ratio(sum(values, ZERO) / Decimal(len(values))),
        "median": ratio(Decimal(str(median([float(v) for v in values])))),
        "n": len(values),
    }


def build_risk_escalation(trades: Sequence[AnalyticsTrade], *, min_n: int = 5) -> dict:
    ordered = ordered_closed(trades)
    baseline_pcts = [t.risk_percent for t in ordered if t.risk_percent > ZERO]
    baseline_avg = sum(baseline_pcts, ZERO) / Decimal(len(baseline_pcts)) if baseline_pcts else None

    def _after_context(predicate) -> list[Decimal]:
        risks: list[Decimal] = []
        for i in range(1, len(ordered)):
            if predicate(i) and ordered[i].risk_percent > ZERO:
                risks.append(ordered[i].risk_percent)
        return risks

    def _after_loss(i: int) -> bool:
        return ordered[i - 1].classify_outcome() == "loss"

    def _after_win(i: int) -> bool:
        return ordered[i - 1].classify_outcome() == "win"

    def _after_n_losses(n: int) -> Callable[[int], bool]:
        def check(i: int) -> bool:
            if i < n:
                return False
            return all(ordered[i - k - 1].classify_outcome() == "loss" for k in range(n))

        return check

    contexts = [
        ("after_win", _after_win, "After win"),
        ("after_loss", _after_loss, "After loss"),
        ("after_two_losses", _after_n_losses(2), "After 2 consecutive losses"),
        ("after_three_losses", _after_n_losses(3), "After 3 consecutive losses"),
    ]

    patterns = []
    for key, pred, label in contexts:
        risks = _after_context(pred)
        stats = _risk_stats(risks)
        pct_diff = None
        adequate = stats["n"] >= min_n and baseline_avg is not None and baseline_avg > ZERO and stats["average"] is not None
        if adequate:
            pct_diff = ratio((Decimal(str(stats["average"])) - baseline_avg) / baseline_avg * Decimal("100"))
        patterns.append(
            {
                "key": key,
                "label": label,
                "average_risk_pct": stats["average"],
                "median_risk_pct": stats["median"],
                "n": stats["n"],
                "baseline_risk_pct": ratio(baseline_avg) if baseline_avg is not None else None,
                "pct_difference_from_baseline": pct_diff,
                "adequate_sample": adequate,
            }
        )

    flagged = [p for p in patterns if p["adequate_sample"] and p["pct_difference_from_baseline"] is not None and Decimal(str(p["pct_difference_from_baseline"])) > Decimal("15")]

    return {
        "baseline_risk_pct": ratio(baseline_avg) if baseline_avg is not None else None,
        "patterns": patterns,
        "label": "RISK ESCALATION PATTERN" if flagged else "RISK CONTEXT RESEARCH",
        "flagged_patterns": [p["key"] for p in flagged],
        "disclaimer": "Research observation only — does not recommend changing risk.",
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(ordered)),
    }


def _quantile_labels(values: list[Decimal], n_buckets: int = 3) -> list[tuple[str, Decimal, Decimal | None]]:
    if not values:
        return []
    xs = sorted(values)
    buckets = []
    for i in range(n_buckets):
        lo_idx = int(i * len(xs) / n_buckets)
        hi_idx = int((i + 1) * len(xs) / n_buckets) - 1
        lo_val = xs[lo_idx]
        hi_val = xs[hi_idx] if hi_idx < len(xs) else xs[-1]
        if n_buckets == 3:
            names = ["Small size", "Medium size", "Large size"]
        else:
            names = [f"Bucket {i + 1}" for i in range(n_buckets)]
        buckets.append((names[i] if i < len(names) else f"Q{i + 1}", lo_val, hi_val if i < n_buckets - 1 else None))
    return buckets


def build_position_size_research(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    with_pct = [t for t in closed if t.risk_percent > ZERO]
    pcts = [t.risk_percent for t in with_pct]

    if len(pcts) < 6:
        return {
            "available": False,
            "reason": "Need at least 6 trades with valid risk % for quantile buckets.",
            "sample": sample_payload(len(with_pct)),
        }

    labels = _quantile_labels(pcts, n_buckets=3)
    buckets = []
    for i, (label, lo, hi) in enumerate(labels):
        if i < len(labels) - 1:
            items = [t for t in with_pct if lo <= t.risk_percent <= hi]
        else:
            items = [t for t in with_pct if t.risk_percent >= lo]
        discs = [t.discipline_score for t in items if t.discipline_score is not None]
        emotional = sum(1 for t in items if t.emotional_trade)
        row = _perf_row(items, starting=starting, label=label)
        buckets.append(
            {
                "label": label,
                "risk_pct_range": {
                    "from": ratio(lo),
                    "to": ratio(hi) if hi is not None else None,
                },
                **row,
                "average_discipline": int(sum(discs) / len(discs)) if discs else None,
                "emotional_trade_count": emotional,
            }
        )

    return {
        "available": True,
        "method": "Tertile buckets from observed risk % distribution in filtered sample.",
        "buckets": buckets,
        "disclaimer": "Position-size segments are descriptive. Psychological effects require cautious interpretation.",
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(with_pct)),
    }


def _apply_conditions(trades: Sequence[AnalyticsTrade], conditions: dict) -> list[AnalyticsTrade]:
    out = []
    for t in closed_trades(list(trades)):
        if conditions.get("setup") and t.setup != conditions["setup"]:
            continue
        if conditions.get("session") and t.session != conditions["session"]:
            continue
        if conditions.get("direction") and t.direction != conditions["direction"]:
            continue
        if conditions.get("timeframe") and t.timeframe != conditions["timeframe"]:
            continue
        if conditions.get("emotion") and (t.emotion_before or "unknown") != conditions["emotion"]:
            continue
        if conditions.get("confirmation") is True:
            if not (t.checklist_total > 0 and t.checklist_checked >= t.checklist_total):
                continue
        if conditions.get("confirmation") is False:
            if t.checklist_total > 0 and t.checklist_checked >= t.checklist_total:
                continue
        if conditions.get("rules_followed") is True and not t.rules_followed:
            continue
        if conditions.get("rules_followed") is False and t.rules_followed:
            continue
        if conditions.get("emotional") is True and not t.emotional_trade:
            continue
        if conditions.get("emotional") is False and t.emotional_trade:
            continue
        out.append(t)
    return out


def explore_combination(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    conditions: dict,
    min_n: int = COMBINATION_MIN_N,
) -> dict:
    matched = _apply_conditions(trades, conditions)
    n = len(matched)
    insufficient = n < min_n
    metrics = _perf_row(matched, starting=starting, label="Combination") if not insufficient else None
    return {
        "conditions": conditions,
        "n": n,
        "min_n_required": min_n,
        "insufficient_sample": insufficient,
        "metrics": metrics,
        "multiple_exploration_notice": (
            "You are comparing filtered conditions. Apparent differences may occur by chance. "
            "Treat low-sample findings as hypotheses for further research."
        ),
        "category": "OBSERVED_PERFORMANCE",
    }


def _auto_combinations(trades: Sequence[AnalyticsTrade], *, starting: Decimal, min_n: int = COMBINATION_MIN_N) -> list[dict]:
    closed = closed_trades(list(trades))
    results: list[dict] = []

    setup_counts: dict[str, int] = defaultdict(int)
    for t in closed:
        setup_counts[t.setup] += 1
    for setup, count in sorted(setup_counts.items(), key=lambda kv: -kv[1]):
        if count < min_n:
            continue
        base = explore_combination(trades, starting=starting, conditions={"setup": setup}, min_n=min_n)
        if not base["insufficient_sample"]:
            results.append({**base, "label": setup})

        for session in {t.session for t in closed if t.setup == setup}:
            combo = explore_combination(
                trades,
                starting=starting,
                conditions={"setup": setup, "session": session},
                min_n=min_n,
            )
            if not combo["insufficient_sample"]:
                results.append({**combo, "label": f"{setup} + {session}"})

    results.sort(key=lambda r: -(float(r["metrics"]["expectancy_r"] or 0) if r.get("metrics") else 0))
    return results[:24]


def build_setup_interactions(trades: Sequence[AnalyticsTrade], *, starting: Decimal, min_n: int = COMBINATION_MIN_N) -> dict:
    closed = closed_trades(list(trades))
    dimensions = ["setup", "session", "direction", "timeframe", "confirmation", "rules_followed", "emotional"]
    values = {
        "setups": sorted({t.setup for t in closed}),
        "sessions": sorted({t.session for t in closed}),
        "directions": sorted({t.direction for t in closed}),
        "timeframes": sorted({t.timeframe for t in closed}),
        "emotions": sorted({t.emotion_before or "unknown" for t in closed}),
    }
    return {
        "dimensions": dimensions,
        "values": values,
        "min_n_required": min_n,
        "highlighted_combinations": _auto_combinations(trades, starting=starting, min_n=min_n),
        "multiple_exploration_notice": (
            "You are comparing many conditions. Apparent differences may occur by chance. "
            "Treat low-sample findings as hypotheses for further research."
        ),
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(closed)),
    }


def build_mfe_mae_research(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    with_mfe = [t for t in closed if t.mfe_r is not None]
    with_mae = [t for t in closed if t.mae_r is not None]

    if not with_mfe and not with_mae:
        return {
            "available": False,
            "status": "MFE/MAE DATA REQUIRED",
            "note": "Excursion data is not available for the filtered sample.",
        }

    def _segment(items: Sequence[AnalyticsTrade], outcome: str) -> dict:
        seg = [t for t in items if t.classify_outcome() == outcome]
        mfe_vals = [t.mfe_r for t in seg if t.mfe_r is not None]
        mae_vals = [t.mae_r for t in seg if t.mae_r is not None]
        mfe_vals_f = [float(v) for v in mfe_vals]
        mae_vals_f = [float(v) for v in mae_vals]
        mae_sorted = sorted(mae_vals_f)

        def pct(vals: list[float], p: float) -> Decimal | None:
            if not vals:
                return None
            idx = int(p * (len(vals) - 1))
            return ratio(Decimal(str(vals[idx])))

        return {
            "n": len(seg),
            "median_mfe_r": ratio(Decimal(str(median(mfe_vals_f)))) if mfe_vals_f else None,
            "average_mfe_r": ratio(sum(mfe_vals, ZERO) / Decimal(len(mfe_vals))) if mfe_vals else None,
            "median_mae_r": ratio(Decimal(str(median(mae_vals_f)))) if mae_vals_f else None,
            "average_mae_r": ratio(sum(mae_vals, ZERO) / Decimal(len(mae_vals))) if mae_vals else None,
            "mae_p75": pct(mae_sorted, 0.75),
        }

    capture_vals = []
    for t in with_mfe:
        if t.mfe_r and t.mfe_r > ZERO and t.r_multiple is not None and t.r_multiple > ZERO:
            capture_vals.append(float(t.r_multiple / t.mfe_r * 100))

    return {
        "available": True,
        "status": "OK",
        "winners": _segment(with_mae, "win"),
        "losers": _segment(with_mae, "loss"),
        "winning_trade_heat": {
            "median_mae_r": _segment(with_mae, "win")["median_mae_r"],
            "p75_mae_r": _segment(with_mae, "win")["mae_p75"],
            "note": "MAE before winning trades — research information only.",
        },
        "mfe_capture": {
            "median_pct": ratio(Decimal(str(median(capture_vals)))) if capture_vals else None,
            "average_pct": ratio(Decimal(str(sum(capture_vals) / len(capture_vals)))) if capture_vals else None,
            "n": len(capture_vals),
        },
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(with_mfe)),
    }


def build_behavior_quant(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    configured_risk: Decimal | None = None,
) -> dict:
    return {
        "discipline": build_discipline_comparisons(trades, starting=starting),
        "risk_escalation": build_risk_escalation(trades),
        "position_size": build_position_size_research(trades, starting=starting),
        "setup_interactions": build_setup_interactions(trades, starting=starting),
        "mfe_mae": build_mfe_mae_research(trades),
        "disclaimer": (
            "Behavior quant compares historical segments. Correlation is not causation. "
            "Use findings as research prompts."
        ),
    }
