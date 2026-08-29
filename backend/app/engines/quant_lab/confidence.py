"""Wilson score confidence intervals for proportions."""

from __future__ import annotations

from decimal import Decimal
from math import sqrt

from app.engines.fx_math import ratio


def wilson_ci(
    successes: int,
    n: int,
    *,
    confidence: float = 0.95,
) -> dict:
    """Wilson score interval for binomial proportion (win rate)."""
    if n <= 0:
        return {
            "observed": None,
            "lower_bound": None,
            "upper_bound": None,
            "confidence_level": confidence,
            "sample_size": 0,
            "available": False,
            "note": "No observations.",
        }
    p_hat = successes / n
    # z for 95% ≈ 1.96
    z = 1.96 if confidence >= 0.95 else 1.645
    z2 = z * z
    denom = 1 + z2 / n
    centre = (p_hat + z2 / (2 * n)) / denom
    margin = (z / denom) * sqrt((p_hat * (1 - p_hat) / n) + (z2 / (4 * n * n)))
    lo = max(0.0, centre - margin)
    hi = min(1.0, centre + margin)
    return {
        "observed": ratio(Decimal(str(p_hat * 100))),
        "lower_bound": ratio(Decimal(str(lo * 100))),
        "upper_bound": ratio(Decimal(str(hi * 100))),
        "confidence_level": confidence,
        "sample_size": n,
        "available": True,
        "method": "wilson_score",
        "category": "STATISTICAL_CONFIDENCE",
        "note": "The observed win rate is an estimate based on the available sample.",
    }
