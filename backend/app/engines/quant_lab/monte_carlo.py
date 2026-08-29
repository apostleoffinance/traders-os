"""Monte Carlo simulation — historical return resampling."""

from __future__ import annotations

import random
from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.fx_math import ratio
from app.engines.quant_lab.sample_policy import sample_payload

DEFAULT_SIMULATIONS = 10_000
DEFAULT_FUTURE_TRADES = 100
DEFAULT_SEED = 42
MIN_SAMPLE = 5
MAX_SIMULATIONS = 25_000
MAX_FUTURE_TRADES = 500


def _pct(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    idx = int(p * (len(sorted_vals) - 1))
    return sorted_vals[idx]


def _max_drawdown(path: Sequence[float]) -> float:
    peak = 0.0
    cum = 0.0
    max_dd = 0.0
    for r in path:
        cum += r
        if cum > peak:
            peak = cum
        dd = peak - cum
        if dd > max_dd:
            max_dd = dd
    return max_dd


def _simulate_path(returns: list[float], n: int, rng: random.Random) -> tuple[float, float, list[float]]:
    path = [returns[rng.randrange(len(returns))] for _ in range(n)]
    ending = sum(path)
    max_dd = _max_drawdown(path)
    return ending, max_dd, path


def run_monte_carlo(
    returns: Sequence[Decimal],
    *,
    simulations: int = DEFAULT_SIMULATIONS,
    future_trades: int = DEFAULT_FUTURE_TRADES,
    seed: int = DEFAULT_SEED,
    unit: str = "R",
    drawdown_threshold: Decimal | None = None,
) -> dict:
    xs = [float(v) for v in returns]
    n = len(xs)
    if n < MIN_SAMPLE:
        return {
            "available": False,
            "reason": f"At least {MIN_SAMPLE} valid observations required.",
            "sample_size": n,
            "category": "SIMULATED_SCENARIOS",
        }

    simulations = min(max(simulations, 100), MAX_SIMULATIONS)
    future_trades = min(max(future_trades, 1), MAX_FUTURE_TRADES)
    rng = random.Random(seed)

    endings: list[float] = []
    max_dds: list[float] = []
    sample_paths: list[dict] = []
    threshold = float(drawdown_threshold) if drawdown_threshold is not None else None
    exceed_dd = 0
    positive_end = 0

    for i in range(simulations):
        ending, max_dd, path = _simulate_path(xs, future_trades, rng)
        endings.append(ending)
        max_dds.append(max_dd)
        if ending > 0:
            positive_end += 1
        if threshold is not None and max_dd >= threshold:
            exceed_dd += 1
        if i < 24:
            sample_paths.append(
                {
                    "ending": ratio(Decimal(str(round(ending, 4)))),
                    "max_drawdown": ratio(Decimal(str(round(max_dd, 4)))),
                    "cumulative": [ratio(Decimal(str(round(v, 4)))) for v in _cumulative(path)[:: max(1, len(path) // 20)]],
                }
            )

    endings.sort()
    max_dds.sort()

    dd_scenarios = {
        "p50": ratio(Decimal(str(_pct(max_dds, 0.50)))),
        "p75": ratio(Decimal(str(_pct(max_dds, 0.75)))),
        "p90": ratio(Decimal(str(_pct(max_dds, 0.90)))),
        "p95": ratio(Decimal(str(_pct(max_dds, 0.95)))),
    }

    return {
        "available": True,
        "category": "SIMULATED_SCENARIOS",
        "config": {
            "simulations": simulations,
            "future_trades": future_trades,
            "seed": seed,
            "unit": unit,
            "drawdown_threshold": ratio(drawdown_threshold) if drawdown_threshold is not None else None,
        },
        "assumptions": [
            "Future trade outcomes are resampled with replacement from the filtered historical sample.",
            "Trade sequence order is randomized — path dependency in the original journal is not preserved.",
            "Market regimes may change; simulations cannot predict future performance.",
        ],
        "historical_sample_size": n,
        "ending_return": {
            "median": ratio(Decimal(str(median(endings)))),
            "mean": ratio(Decimal(str(sum(endings) / len(endings)))),
            "p5": ratio(Decimal(str(_pct(endings, 0.05)))),
            "p95": ratio(Decimal(str(_pct(endings, 0.95)))),
        },
        "max_drawdown": {
            "median": ratio(Decimal(str(_pct(max_dds, 0.50)))),
            "p75": ratio(Decimal(str(_pct(max_dds, 0.75)))),
            "p95": ratio(Decimal(str(_pct(max_dds, 0.95)))),
        },
        "drawdown_at_risk": {
            **dd_scenarios,
            "note": "Percentile labels describe simulated maximum drawdown over the future trade horizon.",
        },
        "probabilities": {
            "positive_ending_return": ratio(Decimal(str(positive_end / simulations * 100))),
            "exceeding_drawdown_threshold": ratio(Decimal(str(exceed_dd / simulations * 100)))
            if threshold is not None
            else None,
        },
        "sample_paths": sample_paths,
        "sample": sample_payload(n),
        "disclaimer": (
            "Under the assumptions of this simulation, results describe possible historical-return "
            "sequences — not forecasts."
        ),
    }


def _cumulative(path: Sequence[float]) -> list[float]:
    out = []
    total = 0.0
    for r in path:
        total += r
        out.append(total)
    return out


def simulation_preview(n: int) -> dict:
    return {
        "status": "AWAITING_RUN",
        "default_config": {
            "simulations": DEFAULT_SIMULATIONS,
            "future_trades": DEFAULT_FUTURE_TRADES,
            "unit": "R",
            "seed": DEFAULT_SEED,
            "drawdown_threshold": "10",
        },
        "allowed_simulations": [1000, 5000, 10000, 25000],
        "allowed_future_trades": [50, 100, 200],
        "historical_sample_size": n,
        "can_run": n >= MIN_SAMPLE,
        "category": "SIMULATED_SCENARIOS",
    }
