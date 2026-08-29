"""Deterministic research opportunity engine for Quant Lab."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.quant_lab.behavioral_quant import COMBINATION_MIN_N
from app.engines.quant_lab.sample_policy import classify_sample


def _opp(
    *,
    id: str,
    type: str,
    severity: str,
    title: str,
    prompt: str,
    evidence: dict,
    sample_size: int,
    cta_tab: str = "research",
    cta_label: str = "Explore in Research",
    priority: int = 50,
) -> dict:
    return {
        "id": id,
        "type": type,
        "severity": severity,
        "title": title,
        "prompt": prompt,
        "evidence": evidence,
        "sample_size": sample_size,
        "cta": {"label": cta_label, "tab": cta_tab},
        "priority": priority,
        "category": "RESEARCH_PROMPT",
    }


def generate_research_opportunities(
    *,
    sample_size: int,
    expectancy_r: str | None,
    edge_stability: dict,
    outliers: dict,
    behavior: dict,
    setup_interactions: dict,
    edge_confidence: dict,
) -> list[dict]:
    opportunities: list[dict] = []

    level = classify_sample(sample_size)
    if level.value in {"INSUFFICIENT", "EXPLORATORY"}:
        opportunities.append(
            _opp(
                id="sample_warning",
                type="SAMPLE_WARNING",
                severity="warning",
                title="Limited sample for advanced inference",
                prompt=f"Your filtered sample has {sample_size} valid trades. Advanced statistical conclusions carry high uncertainty.",
                evidence={"sample_size": sample_size, "evidence_level": level.value},
                sample_size=sample_size,
                cta_tab="overview",
                priority=90,
            )
        )

    # Outlier dependency
    dep = outliers.get("profit_dependency_top_5_pct")
    if dep is not None and Decimal(str(dep)) >= Decimal("35"):
        opportunities.append(
            _opp(
                id="outlier_dependency",
                type="OUTLIER_DEPENDENCY",
                severity="observation",
                title="Profit concentrated in top trades",
                prompt=(
                    f"{dep}% of net profit came from your top 5 trades. "
                    "Investigate robustness without outliers."
                ),
                evidence={"top_5_dependency_pct": dep, "level": outliers.get("dependency_level")},
                sample_size=sample_size,
                cta_tab="robustness",
                cta_label="View Robustness",
                priority=80,
            )
        )

    # Recent change
    diff = edge_stability.get("differences", {}).get("expectancy_r", {})
    pct = diff.get("percentage")
    recent_n = edge_stability.get("recent", {}).get("n", 0)
    if pct is not None and recent_n >= 10:
        p = Decimal(str(pct))
        if abs(p) >= Decimal("30"):
            opportunities.append(
                _opp(
                    id="recent_change",
                    type="RECENT_CHANGE",
                    severity="observation",
                    title="Recent performance differs from historical sample",
                    prompt=edge_stability.get("disclaimer", "Possible performance change — more data may be required."),
                    evidence={
                        "historical_expectancy_r": edge_stability.get("historical", {}).get("expectancy_r"),
                        "recent_expectancy_r": edge_stability.get("recent", {}).get("expectancy_r"),
                        "change_pct": pct,
                        "recent_n": recent_n,
                    },
                    sample_size=recent_n,
                    cta_tab="edge",
                    cta_label="View Edge Stability",
                    priority=75,
                )
            )

    # Discipline alpha
    rules = behavior.get("discipline", {}).get("comparisons", {}).get("rules_followed_vs_broken", {})
    alpha = rules.get("discipline_alpha_r")
    if rules.get("group_a", {}).get("n", 0) >= 5 and rules.get("group_b", {}).get("n", 0) >= 5 and alpha is not None:
        if Decimal(str(alpha)) > Decimal("0.2"):
            opportunities.append(
                _opp(
                    id="discipline_alpha",
                    type="DISCIPLINE_ALPHA",
                    severity="opportunity",
                    title="Rules-followed trades show higher observed expectancy",
                    prompt=(
                        "Rules-followed trades had higher historical expectancy than rule-breaking trades. "
                        "Association only — explore discipline segments."
                    ),
                    evidence={"discipline_alpha_r": alpha, "rules_followed_n": rules["group_a"]["n"]},
                    sample_size=rules["group_a"]["n"] + rules["group_b"]["n"],
                    priority=70,
                )
            )

    # Risk escalation
    for pattern in behavior.get("risk_escalation", {}).get("patterns", []):
        if pattern.get("key") == "after_loss" and pattern.get("adequate_sample"):
            pct_diff = pattern.get("pct_difference_from_baseline")
            if pct_diff and Decimal(str(pct_diff)) > Decimal("15"):
                opportunities.append(
                    _opp(
                        id="risk_after_loss",
                        type="RISK_PATTERN",
                        severity="warning",
                        title="Risk increases after losses",
                        prompt=(
                            f"Average risk after losses was {pct_diff}% higher than baseline "
                            f"(n={pattern.get('n')}). Research observation only."
                        ),
                        evidence=pattern,
                        sample_size=pattern.get("n", 0),
                        priority=72,
                    )
                )
                break

    # Setup combinations
    combos = setup_interactions.get("highlighted_combinations", [])
    if combos:
        best = combos[0]
        if best.get("metrics") and best.get("n", 0) >= COMBINATION_MIN_N:
            opportunities.append(
                _opp(
                    id="setup_highlight",
                    type="SETUP_DIFFERENCE",
                    severity="opportunity",
                    title=f"Strongest observed combination: {best.get('label')}",
                    prompt=(
                        f"{best['label']} shows {best['metrics'].get('expectancy_r')}R expectancy "
                        f"over {best['n']} trades in your filtered sample."
                    ),
                    evidence={"combination": best},
                    sample_size=best["n"],
                    priority=65,
                )
            )
        weak = [c for c in combos if c.get("metrics", {}).get("expectancy_r") and Decimal(str(c["metrics"]["expectancy_r"])) < 0]
        if weak:
            w = weak[-1]
            if w.get("n", 0) >= COMBINATION_MIN_N:
                opportunities.append(
                    _opp(
                        id="setup_underperformance",
                        type="SETUP_DIFFERENCE",
                        severity="observation",
                        title=f"Underperforming combination: {w.get('label')}",
                        prompt=f"{w['label']} has negative observed expectancy in your sample.",
                        evidence={"combination": w},
                        sample_size=w["n"],
                        priority=60,
                    )
                )

    # Low edge confidence
    if edge_confidence.get("score", 100) < 45:
        opportunities.append(
            _opp(
                id="low_edge_confidence",
                type="EDGE_CONFIDENCE",
                severity="info",
                title="Edge confidence is low on current evidence",
                prompt="Review sample size, stability, and outlier dependency before drawing strong conclusions.",
                evidence={"edge_confidence": edge_confidence},
                sample_size=sample_size,
                cta_tab="overview",
                cta_label="View Overview",
                priority=55,
            )
        )

    # Small sample on best setup
    setup_counts: dict[str, int] = {}
    for c in combos:
        label = c.get("label", "")
        if "+" not in label:
            setup_counts[label] = c.get("n", 0)
    for setup, n in setup_counts.items():
        if 3 <= n < COMBINATION_MIN_N:
            opportunities.append(
                _opp(
                    id=f"small_sample_{setup}",
                    type="SAMPLE_WARNING",
                    severity="info",
                    title=f"Limited data for setup: {setup}",
                    prompt=f"Your {setup} setup has only {n} trades in this filter — treat metrics as exploratory.",
                    evidence={"setup": setup, "n": n},
                    sample_size=n,
                    priority=58,
                )
            )
            break

    return sorted(opportunities, key=lambda x: -x["priority"])


def build_research_section(
    *,
    sample_size: int,
    expectancy_r: str | None,
    edge_stability: dict,
    outliers: dict,
    behavior: dict,
    setup_interactions: dict,
    edge_confidence: dict,
) -> dict:
    opportunities = generate_research_opportunities(
        sample_size=sample_size,
        expectancy_r=expectancy_r,
        edge_stability=edge_stability,
        outliers=outliers,
        behavior=behavior,
        setup_interactions=setup_interactions,
        edge_confidence=edge_confidence,
    )
    return {
        "opportunities": opportunities,
        "count": len(opportunities),
        "multiple_exploration_notice": setup_interactions.get(
            "multiple_exploration_notice",
            "Treat exploratory findings as hypotheses for further research.",
        ),
        "disclaimer": "Research prompts are deterministic observations — not trading recommendations.",
    }
