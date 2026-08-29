"""Compact Quant Lab payload for LLM context — pre-computed only."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.builder import build_quant_lab


def quant_ai_summary(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    configured_risk: Decimal | None = None,
) -> dict:
    lab = build_quant_lab(trades, starting=starting, configured_risk=configured_risk)
    overview = lab["overview"]
    edge = lab["edge"]
    research = lab.get("research", {})
    edge_conf = lab.get("edge_confidence", {})
    walk = lab.get("walk_forward", {})

    return {
        "meta": {
            "valid_trades": lab["meta"]["valid_trades"],
            "evidence_level": overview["sample_policy"]["evidence_level"],
        },
        "expectancy": {
            "expectancy_r": overview["expectancy_summary"]["expectancy_r"],
            "win_rate": overview["expectancy_summary"]["win_rate"],
            "n": overview["expectancy_summary"]["n"],
        },
        "edge_stability": {
            "historical_expectancy_r": edge["edge_stability"]["historical"].get("expectancy_r"),
            "recent_expectancy_r": edge["edge_stability"]["recent"].get("expectancy_r"),
            "recent_n": edge["edge_stability"]["recent"].get("n"),
        },
        "drawdown": {
            "max_drawdown_r": overview["edge_status"]["max_drawdown_r"],
            "ulcer_index_r": lab["drawdown"]["ulcer_index_r"].get("ulcer_index_r"),
        },
        "outliers": {
            "dependency_level": lab["outliers"]["dependency_level"],
            "top_5_dependency_pct": lab["outliers"]["profit_dependency_top_5_pct"],
        },
        "edge_confidence": {
            "score": edge_conf.get("score"),
            "label": edge_conf.get("label"),
            "components": {
                k: {"score": v.get("score"), "note": v.get("note")}
                for k, v in (edge_conf.get("components") or {}).items()
            },
        },
        "research_opportunities": [
            {
                "title": o["title"],
                "type": o["type"],
                "severity": o["severity"],
                "prompt": o["prompt"],
                "sample_size": o["sample_size"],
            }
            for o in research.get("opportunities", [])[:6]
        ],
        "walk_forward": {
            "in_sample_expectancy_r": walk.get("in_sample", {}).get("expectancy_r"),
            "out_of_sample_expectancy_r": walk.get("out_of_sample", {}).get("expectancy_r"),
            "in_sample_n": walk.get("in_sample", {}).get("n"),
            "out_of_sample_n": walk.get("out_of_sample", {}).get("n"),
            "label": walk.get("label"),
        },
        "discipline_alpha_r": (
            lab["behavior"]["discipline"]["comparisons"]["rules_followed_vs_broken"].get("discipline_alpha_r")
        ),
        "note": (
            "All values are deterministic Quant Lab metrics. "
            "Do not invent numbers. Describe associations only — never recommend trades."
        ),
    }
