"""Transparent Edge Confidence composite — not proof of profitability."""

from __future__ import annotations

from decimal import Decimal

from app.engines.fx_math import ZERO, ratio
from app.engines.quant_lab.sample_policy import EvidenceLevel, classify_sample


def _clamp(score: int) -> int:
    return max(0, min(100, score))


def _sample_score(n: int) -> tuple[int, str]:
    level = classify_sample(n)
    mapping = {
        EvidenceLevel.INSUFFICIENT: (15, "Very limited sample."),
        EvidenceLevel.EXPLORATORY: (35, "Exploratory sample only."),
        EvidenceLevel.MODERATE: (55, "Moderate sample — uncertainty remains."),
        EvidenceLevel.STRONGER: (75, "Larger sample — patterns may be more stable."),
        EvidenceLevel.HIGHER_EVIDENCE: (90, "Higher evidence sample."),
    }
    score, note = mapping[level]
    return score, note


def _stability_score(edge_stability: dict) -> tuple[int, str]:
    diff = edge_stability.get("differences", {}).get("expectancy_r", {})
    pct = diff.get("percentage")
    if pct is None:
        return 50, "Insufficient data for stability comparison."
    p = abs(float(Decimal(str(pct))))
    if p <= 15:
        return 85, "Recent and historical expectancy are closely aligned."
    if p <= 35:
        return 65, "Moderate divergence between recent and historical expectancy."
    if p <= 60:
        return 45, "Material divergence between recent and historical expectancy."
    return 25, "Large divergence — stability is uncertain."


def _outlier_score(outliers: dict) -> tuple[int, str]:
    dep = outliers.get("profit_dependency_top_5_pct")
    if dep is None:
        return 50, "Outlier dependency not computed (non-positive net profit)."
    d = float(Decimal(str(dep)))
    if d <= 25:
        return 85, "Low concentration in top trades."
    if d <= 50:
        return 60, "Moderate concentration in top trades."
    return 35, "High concentration in top trades."


def _drawdown_score(drawdown: dict, top_trade_removal: dict) -> tuple[int, str]:
    max_dd_r = drawdown.get("r_multiple", {}).get("max_drawdown_r")
    scenarios = top_trade_removal.get("scenarios", [])
    without_top5 = next((s for s in scenarios if "top 5" in s.get("label", "").lower()), None)
    score = 55
    note = "Drawdown robustness assessed from observed curve."
    if without_top5 and without_top5.get("expectancy_r") is not None:
        exp = Decimal(str(without_top5["expectancy_r"]))
        if exp > 0:
            score = 75
            note = "Expectancy remains positive after removing top 5 trades."
        else:
            score = 40
            note = "Expectancy turns negative after removing top 5 trades."
    if max_dd_r is not None and Decimal(str(max_dd_r)) > Decimal("10"):
        score = max(20, score - 15)
        note += " Large historical max drawdown observed."
    return _clamp(score), note


def build_edge_confidence(
    *,
    sample_size: int,
    expectancy_r: Decimal | str | None,
    edge_stability: dict,
    outliers: dict,
    drawdown: dict,
    top_trade_removal: dict,
) -> dict:
    s_sample, n_sample = _sample_score(sample_size)
    s_stab, n_stab = _stability_score(edge_stability)
    s_out, n_out = _outlier_score(outliers)
    s_dd, n_dd = _drawdown_score(drawdown, top_trade_removal)

    # Expectancy direction component
    s_exp = 50
    n_exp = "Neutral expectancy baseline."
    if expectancy_r is not None:
        er = Decimal(str(expectancy_r))
        if er > Decimal("0.3"):
            s_exp = 70
            n_exp = "Positive observed expectancy R."
        elif er > ZERO:
            s_exp = 58
            n_exp = "Slightly positive observed expectancy R."
        elif er < ZERO:
            s_exp = 35
            n_exp = "Negative observed expectancy R."

    weights = {
        "sample_adequacy": 0.30,
        "performance_stability": 0.25,
        "outlier_robustness": 0.20,
        "drawdown_stability": 0.15,
        "expectancy_direction": 0.10,
    }
    components = {
        "sample_adequacy": {"score": s_sample, "weight": weights["sample_adequacy"], "note": n_sample},
        "performance_stability": {"score": s_stab, "weight": weights["performance_stability"], "note": n_stab},
        "outlier_robustness": {"score": s_out, "weight": weights["outlier_robustness"], "note": n_out},
        "drawdown_stability": {"score": s_dd, "weight": weights["drawdown_stability"], "note": n_dd},
        "expectancy_direction": {"score": s_exp, "weight": weights["expectancy_direction"], "note": n_exp},
    }
    overall = sum(c["score"] * c["weight"] for c in components.values())
    overall_int = _clamp(int(round(overall)))

    if overall_int >= 75:
        label = "STRONGER"
    elif overall_int >= 55:
        label = "MODERATE"
    elif overall_int >= 35:
        label = "EXPLORATORY"
    else:
        label = "INSUFFICIENT"

    return {
        "score": overall_int,
        "label": label,
        "components": components,
        "formula": "Weighted sum of sample adequacy, stability, outlier robustness, drawdown stability, and expectancy direction.",
        "disclaimer": (
            "Edge Confidence is a transparent research index — not proof of profitability or future performance."
        ),
        "category": "STATISTICAL_CONFIDENCE",
    }
