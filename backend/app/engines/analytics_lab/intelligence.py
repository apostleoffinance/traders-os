"""Phase 3 Intelligence Lab orchestrator."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.behaviour_intel import build_behaviour_intelligence
from app.engines.analytics_lab.comparison_intel import build_comparison, preset_comparisons
from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.decision_quality import build_decision_quality
from app.engines.analytics_lab.discipline_intel import build_discipline_intelligence
from app.engines.analytics_lab.edge_map import build_edge_maps
from app.engines.analytics_lab.improvement import build_improvement_timeline
from app.engines.analytics_lab.insights import generate_insights
from app.engines.analytics_lab.playbook_intel import build_playbook_intelligence
from app.engines.analytics_lab.psychology_intel import build_psychology_intelligence
from app.engines.analytics_lab.statistics import bootstrap_ci, spearman_rho, correlation_strength
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades


def build_intelligence_lab(
    trades: Sequence,
    *,
    starting: Decimal,
    configured_risk: Decimal | None,
    max_trades_per_day: int | None = None,
) -> dict:
    rows: list[AnalyticsTrade] = list(trades)
    closed = closed_trades(rows)
    n = len(closed)

    behaviour = build_behaviour_intelligence(rows, starting=starting, configured_risk=configured_risk)
    psychology = build_psychology_intelligence(rows, starting=starting)
    discipline = build_discipline_intelligence(rows, starting=starting, configured_risk=configured_risk)
    playbooks = build_playbook_intelligence(rows, starting=starting)
    edge_maps = build_edge_maps(rows, starting=starting)
    decision_quality = build_decision_quality(rows)
    improvement = build_improvement_timeline(rows, starting=starting)

    rs = [float(t.r_multiple) for t in closed if t.r_multiple is not None]
    discs = [float(t.discipline_score) for t in closed if t.discipline_score is not None]
    associations = []
    if len(rs) >= 5 and len(discs) == len(rs):
        rho = spearman_rho(discs, rs)
        associations.append(
            {
                "x": "discipline_score",
                "y": "r_multiple",
                "rho": round(rho, 4) if rho is not None else None,
                "strength": correlation_strength(rho),
                "disclaimer": "Correlation does not equal causation.",
                "n": len(rs),
            }
        )

    insights = generate_insights(
        behaviour=behaviour,
        psychology=psychology,
        discipline=discipline,
        playbooks=playbooks,
        edge_maps=edge_maps,
        decision_quality=decision_quality,
        improvement=improvement,
    )

    rs_dec = [t.r_multiple for t in closed if t.r_multiple is not None]
    bootstrap = bootstrap_ci(rs_dec) if rs_dec else {"available": False}

    return {
        "metadata": {
            "sample_size": n,
            "confidence": confidence_payload(n, metric="Intelligence Lab"),
            "trades_analyzed": n,
            "philosophy": "Personal trading intelligence — descriptive, sample-aware, never predictive.",
        },
        "behaviour": behaviour,
        "psychology": psychology,
        "discipline": discipline,
        "playbooks": playbooks,
        "edge_maps": edge_maps,
        "decision_quality": decision_quality,
        "improvement": improvement,
        "comparisons": {
            "presets": preset_comparisons(rows, starting=starting),
            "custom_available": True,
        },
        "statistics": {
            "expectancy_bootstrap": bootstrap,
            "associations": associations,
        },
        "insights": insights,
        "segments": _deterministic_segments(closed),
    }


def _deterministic_segments(closed: list[AnalyticsTrade]) -> dict:
    return {
        "high_discipline": sum(1 for t in closed if t.discipline_score is not None and t.discipline_score >= 85),
        "low_discipline": sum(1 for t in closed if t.discipline_score is not None and t.discipline_score < 70),
        "high_risk": sum(1 for t in closed if t.risk_percent >= Decimal("2")),
        "emotional": sum(1 for t in closed if t.emotional_trade),
        "outside_session": sum(1 for t in closed if not t.in_preferred_session),
        "post_loss": "see behaviour.revenge_trading",
    }


def intelligence_ai_summary(
    trades: Sequence,
    *,
    starting: Decimal,
    configured_risk: Decimal | None,
) -> dict:
    """Compact intelligence payload for LLM context — pre-computed only."""
    lab = build_intelligence_lab(
        trades,
        starting=starting,
        configured_risk=configured_risk,
    )
    playbooks = lab.get("playbooks", {}).get("playbooks", [])
    top_pb = playbooks[0] if playbooks else None
    checklist_items = (
        lab.get("discipline", {})
        .get("checklist_impact", {})
        .get("items", [])
    )
    return {
        "metadata": lab["metadata"],
        "insights": lab["insights"][:8],
        "behaviour": {
            "risk_after_loss_pct": lab["behaviour"]["revenge_trading"].get("risk_multiplier_after_loss_pct"),
            "revenge_trade_count": lab["behaviour"]["revenge_trading"].get("revenge_trade_count"),
            "overtrading_status": lab["behaviour"]["overtrading"].get("status"),
        },
        "decision_quality": lab["decision_quality"]["counts"],
        "top_playbook": {
            "name": top_pb["name"],
            "expectancy_r": top_pb.get("expectancy_r"),
            "n": top_pb.get("trade_count"),
        }
        if top_pb
        else None,
        "weakness_count": len(lab["edge_maps"].get("weakness_map", [])),
        "checklist_items": checklist_items[:6],
        "improvement_available": lab["improvement"].get("available"),
        "statistics": lab.get("statistics"),
        "note": "All values are deterministic. Do not invent metrics. Describe associations only.",
    }
