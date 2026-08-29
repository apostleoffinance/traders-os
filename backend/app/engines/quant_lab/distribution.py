"""Return distribution analysis — R-multiple preferred."""

from __future__ import annotations

from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import _stdev_sample
from app.engines.quant_lab.sample_policy import sample_payload


def _percentile(sorted_vals: list[Decimal], pct: float) -> Decimal | None:
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * pct
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] * Decimal(str(c - k)) + sorted_vals[c] * Decimal(str(k - f))


def _histogram(values: list[float], *, n_bins: int | None = None) -> list[dict]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    bins_n = n_bins or min(16, max(6, len(values) // 3 or 6))
    width = (hi - lo) / bins_n if hi != lo else 1.0
    bins = []
    for i in range(bins_n):
        a = lo + i * width
        b = lo + (i + 1) * width
        if i < bins_n - 1:
            count = sum(1 for x in values if a <= x < b)
        else:
            count = sum(1 for x in values if a <= x <= hi)
            b = hi
        bins.append({"from": round(a, 4), "to": round(b, 4), "n": count})
    return bins


def _skewness(values: Sequence[Decimal]) -> Decimal | None:
    n = len(values)
    if n < 3:
        return None
    mu = sum(values, ZERO) / Decimal(n)
    sd = _stdev_sample(values)
    if sd is None or sd == ZERO:
        return None
    m3 = sum(((v - mu) / sd) ** 3 for v in values) / Decimal(n)
    adjust = Decimal(n) / (Decimal(n - 1) * Decimal(n - 2))
    return ratio(m3 * adjust * Decimal(n))


def _excess_kurtosis(values: Sequence[Decimal]) -> Decimal | None:
    n = len(values)
    if n < 4:
        return None
    mu = sum(values, ZERO) / Decimal(n)
    sd = _stdev_sample(values)
    if sd is None or sd == ZERO:
        return None
    m4 = sum(((v - mu) / sd) ** 4 for v in values) / Decimal(n)
    # Excess kurtosis with sample adjustment (Fisher)
    term = (Decimal(n) * (Decimal(n) + 1)) / (Decimal(n - 1) * Decimal(n - 2) * Decimal(n - 3))
    correction = (Decimal(3) * (Decimal(n - 1) ** 2)) / (Decimal(n - 2) * Decimal(n - 3))
    return ratio(term * m4 - correction)


def _interpret_skewness(skew: Decimal | None) -> dict:
    if skew is None:
        return {"label": None, "text": "Insufficient data for skewness interpretation."}
    s = float(skew)
    if s > 0.5:
        return {
            "label": "POSITIVE SKEW",
            "text": "Returns include occasional larger positive outcomes.",
        }
    if s < -0.5:
        return {
            "label": "NEGATIVE SKEW",
            "text": "Returns include occasional larger negative outcomes.",
        }
    return {
        "label": "APPROXIMATELY SYMMETRIC",
        "text": "Return distribution is roughly symmetric around the mean.",
    }


def _interpret_kurtosis(kurt: Decimal | None) -> dict:
    if kurt is None:
        return {"label": None, "text": "Insufficient data for kurtosis interpretation."}
    k = float(kurt)
    if k > 1:
        return {
            "label": "HEAVY TAILS",
            "text": "Distribution has fatter tails than a normal distribution — extreme outcomes occur more often.",
        }
    if k < -1:
        return {
            "label": "LIGHT TAILS",
            "text": "Distribution has thinner tails than a normal distribution.",
        }
    return {
        "label": "MODERATE TAILS",
        "text": "Tail behavior is moderately close to a normal distribution.",
    }


def _series_block(values: list[Decimal], *, unit: str) -> dict:
    n = len(values)
    if not values:
        return {
            "n": 0,
            "unit": unit,
            "core": {
                "mean": None,
                "median": None,
                "stdev": None,
                "min": None,
                "max": None,
                "percentiles": {},
            },
            "advanced": {"skewness": None, "excess_kurtosis": None},
            "histogram": [],
            "sample": sample_payload(0),
        }
    xs = sorted(values)
    mu = sum(values, ZERO) / Decimal(n)
    fmt = ratio if unit == "R" else money
    skew = _skewness(values)
    kurt = _excess_kurtosis(values)
    return {
        "n": n,
        "unit": unit,
        "core": {
            "mean": fmt(mu),
            "median": fmt(Decimal(str(median([float(v) for v in xs])))),
            "stdev": ratio(_stdev_sample(values)) if n >= 2 else None,
            "min": fmt(xs[0]),
            "max": fmt(xs[-1]),
            "percentiles": {
                "p10": fmt(_percentile(xs, 0.10)),
                "p25": fmt(_percentile(xs, 0.25)),
                "p50": fmt(_percentile(xs, 0.50)),
                "p75": fmt(_percentile(xs, 0.75)),
                "p90": fmt(_percentile(xs, 0.90)),
            },
        },
        "advanced": {
            "skewness": ratio(skew) if skew is not None else None,
            "excess_kurtosis": ratio(kurt) if kurt is not None else None,
            "skewness_interpretation": _interpret_skewness(skew),
            "kurtosis_interpretation": _interpret_kurtosis(kurt),
        },
        "histogram": _histogram([float(v) for v in values]),
        "sample": sample_payload(n),
        "category": "OBSERVED_PERFORMANCE",
    }


def build_distribution(trades: Sequence[AnalyticsTrade]) -> dict:
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    pnls = [t.net_pnl for t in trades]
    prefer_r = len(rs) >= max(1, len(pnls) // 2)
    primary = _series_block(rs, unit="R") if prefer_r and rs else _series_block(pnls, unit="currency")
    return {
        "preferred_unit": "R" if prefer_r and rs else "currency",
        "r_multiple": _series_block(rs, unit="R"),
        "currency": _series_block(pnls, unit="currency"),
        "primary": primary,
        "note": "Distribution describes historical trade outcomes — not future return forecasts.",
        "category": "OBSERVED_PERFORMANCE",
    }
