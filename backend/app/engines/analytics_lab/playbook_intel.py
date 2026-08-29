"""Playbook Intelligence — setup-based playbooks with drift detection."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median, pstdev
from typing import Sequence

from app.engines.analytics_lab.confidence import ConfidenceLevel, classify_confidence, confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows, ordered_closed
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ZERO, ratio
from app.engines.performance_engine import compute_performance
from app.engines.risk_engine import ClosedTrade, TradeStatus

DRIFT_WINDOWS = (10, 20, 50)


def _playbook_key(t: AnalyticsTrade) -> str:
    return t.setup or "unclassified"


def _edge_quality_score(
    *,
    expectancy_r: Decimal | None,
    n: int,
    rs: list[Decimal],
    max_dd_r: Decimal | None,
    recent_exp: Decimal | None,
    hist_exp: Decimal | None,
) -> dict:
    """Transparent edge quality — not just profitability."""
    components = {}
    score = ZERO
    if expectancy_r is not None:
        exp_component = min(Decimal("30"), max(ZERO, expectancy_r * Decimal("15") + Decimal("15")))
        components["expectancy"] = float(exp_component)
        score += exp_component
    sample_component = min(Decimal("25"), Decimal(str(n)) / Decimal("2"))
    components["sample_size"] = float(sample_component)
    score += sample_component
    if len(rs) >= 3:
        mu = sum(rs, ZERO) / Decimal(len(rs))
        _ = mu  # consistency uses pstdev of floats
        consistency = min(Decimal("20"), Decimal("20") / (Decimal("1") + Decimal(str(pstdev([float(r) for r in rs])))))
        components["consistency"] = float(consistency)
        score += consistency
    if max_dd_r is not None:
        dd_component = max(ZERO, Decimal("15") - max_dd_r * Decimal("5"))
        components["drawdown"] = float(dd_component)
        score += dd_component
    if recent_exp is not None and hist_exp is not None:
        stability = max(ZERO, Decimal("10") - abs(recent_exp - hist_exp) * Decimal("10"))
        components["recent_stability"] = float(stability)
        score += stability
    return {
        "score": ratio(min(score, Decimal("100"))),
        "components": components,
        "formula": "expectancy(30) + sample(25) + consistency(20) + drawdown(15) + stability(10)",
    }


def _drift_status(recent: Decimal | None, historical: Decimal | None, n_recent: int) -> str:
    if classify_confidence(n_recent) == ConfidenceLevel.INSUFFICIENT:
        return "INSUFFICIENT_DATA"
    if recent is None or historical is None:
        return "INSUFFICIENT_DATA"
    diff = recent - historical
    if diff > Decimal("0.15"):
        return "IMPROVING"
    if diff < Decimal("-0.15"):
        return "WEAKENING"
    return "STABLE"


def build_playbook_intelligence(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    by_playbook: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in closed:
        by_playbook[_playbook_key(t)].append(t)

    playbooks = []
    for name, items in sorted(by_playbook.items(), key=lambda kv: -len(kv[1])):
        journals = journal_rows(items)
        row = dump_perf_group(name, journals, starting, "Playbook")
        rs = [t.r_multiple for t in items if t.r_multiple is not None]
        holds = [t.holding_time_seconds for t in items if t.holding_time_seconds]
        disc = [t.discipline_score for t in items if t.discipline_score is not None]
        mfe = [t.mfe_r for t in items if t.mfe_r is not None]
        mae = [t.mae_r for t in items if t.mae_r is not None]

        ordered = sorted(items, key=lambda t: t.exit_at or t.entry_at)
        drift = {}
        for w in DRIFT_WINDOWS:
            recent = ordered[-w:] if len(ordered) >= w else ordered
            hist = ordered[:-w] if len(ordered) > w else []
            recent_rs = [t.r_multiple for t in recent if t.r_multiple is not None]
            hist_rs = [t.r_multiple for t in hist if t.r_multiple is not None]
            recent_exp = sum(recent_rs, ZERO) / Decimal(len(recent_rs)) if recent_rs else None
            hist_exp = sum(hist_rs, ZERO) / Decimal(len(hist_rs)) if hist_rs else None
            drift[f"last_{w}"] = {
                "n": len(recent),
                "expectancy_r": ratio(recent_exp) if recent_exp is not None else None,
                "historical_expectancy_r": ratio(hist_exp) if hist_exp is not None else None,
                "status": _drift_status(recent_exp, hist_exp, len(recent)),
            }

        # Conditions: session, symbol breakdowns
        conditions = []
        for dim, fn in (("session", lambda t: t.session), ("instrument", lambda t: t.symbol), ("direction", lambda t: t.direction)):
            sub: dict[str, list] = defaultdict(list)
            for t in items:
                sub[fn(t)].append(t)
            for key, sub_items in sub.items():
                if len(sub_items) < 2:
                    continue
                sub_row = dump_perf_group(key, journal_rows(sub_items), starting, dim)
                conditions.append({"dimension": dim, "value": key, "n": sub_row["n"], "expectancy_r": sub_row["expectancy_r"], "win_rate": sub_row["win_rate"]})

        eq = _edge_quality_score(
            expectancy_r=Decimal(str(row["expectancy_r"])) if row.get("expectancy_r") else None,
            n=row["n"],
            rs=rs,
            max_dd_r=None,
            recent_exp=Decimal(str(drift.get("last_20", {}).get("expectancy_r") or 0)) if drift.get("last_20") else None,
            hist_exp=Decimal(str(drift.get("last_20", {}).get("historical_expectancy_r") or 0)) if drift.get("last_20") else None,
        )

        playbooks.append(
            {
                "name": name,
                "setup_id": items[0].setup_id,
                "trade_count": row["n"],
                "win_rate": row["win_rate"],
                "profit_factor": row["profit_factor"],
                "expectancy_r": row["expectancy_r"],
                "average_r": row["average_r"],
                "median_r": ratio(Decimal(str(median([float(r) for r in rs])))) if rs else None,
                "average_hold_seconds": int(sum(holds) / len(holds)) if holds else None,
                "average_mfe_r": ratio(sum(mfe, ZERO) / Decimal(len(mfe))) if mfe else None,
                "average_mae_r": ratio(sum(mae, ZERO) / Decimal(len(mae))) if mae else None,
                "discipline_avg": int(sum(disc) / len(disc)) if disc else None,
                "edge_quality": eq,
                "drift": drift,
                "conditions": sorted(conditions, key=lambda c: -float(c.get("expectancy_r") or 0))[:12],
                "evidence": row["evidence"],
                "confidence": confidence_payload(row["n"], metric=name),
            }
        )

    return {
        "playbooks": playbooks,
        "sample_size": len(closed),
        "disclaimer": "Playbooks are derived from your setup tags. Edge quality considers sample size and consistency — not just return.",
    }
