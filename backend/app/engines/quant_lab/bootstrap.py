"""Bootstrap resampling for Quant Lab."""

from __future__ import annotations

import random
from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.fx_math import ratio

DEFAULT_ITERATIONS = 5000
DEFAULT_SEED = 42


def _histogram_bins(samples: list[float], *, bins: int = 20) -> list[dict]:
    if not samples:
        return []
    lo = min(samples)
    hi = max(samples)
    if lo == hi:
        return [{"from": lo, "to": hi, "n": len(samples)}]
    width = (hi - lo) / bins
    counts = [0] * bins
    for value in samples:
        idx = min(bins - 1, int((value - lo) / width)) if width > 0 else 0
        counts[idx] += 1
    return [
        {"from": lo + i * width, "to": lo + (i + 1) * width, "n": counts[i]}
        for i in range(bins)
        if counts[i] > 0
    ]


def bootstrap_expectancy(
    values: Sequence[Decimal],
    *,
    iterations: int = DEFAULT_ITERATIONS,
    seed: int = DEFAULT_SEED,
    alpha: float = 0.05,
) -> dict:
    xs = [float(v) for v in values]
    n = len(xs)
    if n < 2:
        est = ratio(Decimal(str(xs[0]))) if n == 1 else None
        return {
            "point_estimate": est,
            "bootstrap_mean": est,
            "median": est,
            "confidence_interval": {"lower": est, "upper": est, "level": 1 - alpha},
            "iterations": 0,
            "available": False,
            "category": "BOOTSTRAPPED_ESTIMATE",
        }
    rng = random.Random(seed)
    samples = []
    for _ in range(iterations):
        draw = [xs[rng.randrange(n)] for _ in range(n)]
        samples.append(sum(draw) / n)
    samples.sort()
    lo = samples[int((alpha / 2) * iterations)]
    hi = samples[int((1 - alpha / 2) * iterations) - 1]
    point = sum(xs) / n
    return {
        "point_estimate": ratio(Decimal(str(point))),
        "bootstrap_mean": ratio(Decimal(str(sum(samples) / len(samples)))),
        "median": ratio(Decimal(str(median(samples)))),
        "confidence_interval": {
            "lower": ratio(Decimal(str(lo))),
            "upper": ratio(Decimal(str(hi))),
            "level": 1 - alpha,
        },
        "distribution_summary": {
            "p5": ratio(Decimal(str(samples[int(0.05 * iterations)]))),
            "p25": ratio(Decimal(str(samples[int(0.25 * iterations)]))),
            "p75": ratio(Decimal(str(samples[int(0.75 * iterations)]))),
            "p95": ratio(Decimal(str(samples[int(0.95 * iterations) - 1]))),
        },
        "histogram": _histogram_bins(samples),
        "iterations": iterations,
        "seed": seed,
        "available": True,
        "category": "BOOTSTRAPPED_ESTIMATE",
        "note": "Bootstrap resampling estimates uncertainty — not observed performance.",
    }


def bootstrap_win_rate(
    binary: Sequence[Decimal],
    *,
    iterations: int = DEFAULT_ITERATIONS,
    seed: int = DEFAULT_SEED,
    alpha: float = 0.05,
) -> dict:
    """Bootstrap win rate (binary 0/1 series) as percentage."""
    xs = [float(v) for v in binary]
    n = len(xs)
    if n < 2:
        est = ratio(Decimal(str(xs[0] * 100))) if n == 1 else None
        return {
            "point_estimate": est,
            "median": est,
            "confidence_interval": {"lower": est, "upper": est, "level": 1 - alpha},
            "iterations": 0,
            "available": False,
            "category": "BOOTSTRAPPED_ESTIMATE",
        }
    rng = random.Random(seed)
    rates = []
    for _ in range(iterations):
        draw = [xs[rng.randrange(n)] for _ in range(n)]
        rates.append(sum(draw) / n * 100)
    rates.sort()
    lo = rates[int((alpha / 2) * iterations)]
    hi = rates[int((1 - alpha / 2) * iterations) - 1]
    point = sum(xs) / n * 100
    return {
        "point_estimate": ratio(Decimal(str(point))),
        "median": ratio(Decimal(str(median(rates)))),
        "confidence_interval": {
            "lower": ratio(Decimal(str(lo))),
            "upper": ratio(Decimal(str(hi))),
            "level": 1 - alpha,
        },
        "iterations": iterations,
        "seed": seed,
        "available": True,
        "category": "BOOTSTRAPPED_ESTIMATE",
    }
