"""Statistical tools for Phase 3 — bootstrap, effect size, correlation."""

from __future__ import annotations

import random
from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.fx_math import ZERO, ratio

BOOTSTRAP_ITERATIONS = 1000
BOOTSTRAP_SEED = 42


def _to_floats(values: Sequence[Decimal]) -> list[float]:
    return [float(v) for v in values]


def bootstrap_ci(
    values: Sequence[Decimal],
    *,
    iterations: int = BOOTSTRAP_ITERATIONS,
    alpha: float = 0.05,
) -> dict:
    xs = _to_floats(values)
    n = len(xs)
    if n < 2:
        est = ratio(Decimal(str(xs[0]))) if n == 1 else None
        return {
            "estimate": est,
            "lower_bound": est,
            "upper_bound": est,
            "n": n,
            "method": "bootstrap",
            "available": False,
        }
    rng = random.Random(BOOTSTRAP_SEED)
    means = []
    for _ in range(iterations):
        sample = [xs[rng.randrange(n)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    lo_idx = int((alpha / 2) * iterations)
    hi_idx = int((1 - alpha / 2) * iterations) - 1
    return {
        "estimate": ratio(Decimal(str(sum(xs) / n))),
        "lower_bound": ratio(Decimal(str(means[lo_idx]))),
        "upper_bound": ratio(Decimal(str(means[hi_idx]))),
        "n": n,
        "method": "bootstrap_percentile",
        "available": True,
    }


def bootstrap_difference(
    a: Sequence[Decimal],
    b: Sequence[Decimal],
    *,
    iterations: int = BOOTSTRAP_ITERATIONS,
) -> dict:
    if len(a) < 2 or len(b) < 2:
        return {"difference": None, "available": False, "n_a": len(a), "n_b": len(b)}
    af = _to_floats(a)
    bf = _to_floats(b)
    rng = random.Random(BOOTSTRAP_SEED + 1)
    diffs = []
    for _ in range(iterations):
        sa = [af[rng.randrange(len(af))] for _ in range(len(af))]
        sb = [bf[rng.randrange(len(bf))] for _ in range(len(bf))]
        diffs.append(sum(sa) / len(sa) - sum(sb) / len(sb))
    diffs.sort()
    lo = diffs[int(0.025 * iterations)]
    hi = diffs[int(0.975 * iterations) - 1]
    return {
        "difference": ratio(Decimal(str(sum(af) / len(af) - sum(bf) / len(bf)))),
        "lower_bound": ratio(Decimal(str(lo))),
        "upper_bound": ratio(Decimal(str(hi))),
        "available": True,
        "n_a": len(a),
        "n_b": len(b),
    }


def effect_size_magnitude(cohens_d: float) -> str:
    ad = abs(cohens_d)
    if ad < 0.2:
        return "NEGLIGIBLE"
    if ad < 0.5:
        return "SMALL"
    if ad < 0.8:
        return "MODERATE"
    return "LARGE"


def cohens_d(a: Sequence[Decimal], b: Sequence[Decimal]) -> float | None:
    if len(a) < 2 or len(b) < 2:
        return None
    af = _to_floats(a)
    bf = _to_floats(b)
    ma, mb = sum(af) / len(af), sum(bf) / len(bf)
    va = sum((x - ma) ** 2 for x in af) / (len(af) - 1)
    vb = sum((x - mb) ** 2 for x in bf) / (len(bf) - 1)
    pooled = ((len(af) - 1) * va + (len(bf) - 1) * vb) / (len(af) + len(bf) - 2)
    if pooled <= 0:
        return None
    return (ma - mb) / (pooled ** 0.5)


def spearman_rho(x: Sequence[float], y: Sequence[float]) -> float | None:
    if len(x) < 3 or len(y) < 3 or len(x) != len(y):
        return None
    n = len(x)

    def ranks(vals: list[float]) -> list[float]:
        sorted_idx = sorted(range(n), key=lambda i: vals[i])
        r = [0.0] * n
        for rank, i in enumerate(sorted_idx, start=1):
            r[i] = float(rank)
        return r

    rx, ry = ranks(list(x)), ranks(list(y))
    d2 = sum((rx[i] - ry[i]) ** 2 for i in range(n))
    return 1 - 6 * d2 / (n * (n * n - 1))


def correlation_strength(rho: float | None) -> str:
    if rho is None:
        return "UNKNOWN"
    ad = abs(rho)
    if ad < 0.2:
        return "WEAK"
    if ad < 0.5:
        return "MODERATE"
    return "STRONG"


def compare_metrics(a: dict, b: dict) -> list[dict]:
    rows = []
    for key in ("n", "win_rate", "profit_factor", "expectancy_r", "average_r", "net_pnl", "max_drawdown"):
        av, bv = a.get(key), b.get(key)
        diff = None
        if av is not None and bv is not None:
            try:
                diff = ratio(Decimal(str(av)) - Decimal(str(bv)))
            except Exception:
                diff = None
        rows.append({"metric": key, "a": av, "b": bv, "difference": diff})
    return rows
