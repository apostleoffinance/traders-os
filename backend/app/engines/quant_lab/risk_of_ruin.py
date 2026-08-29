"""Risk of ruin — simulation-based threshold crossing estimate."""

from __future__ import annotations

import random
from decimal import Decimal
from typing import Sequence

from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.monte_carlo import MIN_SAMPLE, MAX_SIMULATIONS, MAX_FUTURE_TRADES
from app.engines.quant_lab.sample_policy import sample_payload


def _simulate_equity_path(
    returns: list[float],
    *,
    starting_equity: float,
    risk_pct: float,
    future_trades: int,
    rng: random.Random,
) -> tuple[float, float, bool]:
    """Return ending equity, max drawdown %, whether ruin threshold was crossed."""
    equity = starting_equity
    peak = starting_equity
    max_dd_pct = 0.0
    ruined = False

    for _ in range(future_trades):
        r = returns[rng.randrange(len(returns))]
        risk_amount = equity * (risk_pct / 100.0)
        pnl = r * risk_amount
        equity += pnl
        if equity > peak:
            peak = equity
        if peak > 0:
            dd_pct = (peak - equity) / peak * 100.0
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct
        if equity <= 0:
            ruined = True
            break

    return equity, max_dd_pct, ruined


def estimate_risk_of_ruin(
    returns: Sequence[Decimal],
    *,
    account_equity: Decimal,
    risk_per_trade_pct: Decimal,
    ruin_drawdown_pct: Decimal = Decimal("20"),
    simulations: int = 10_000,
    future_trades: int = 200,
    seed: int = 42,
) -> dict:
    xs = [float(v) for v in returns]
    n = len(xs)
    if n < MIN_SAMPLE:
        return {
            "available": False,
            "reason": f"At least {MIN_SAMPLE} valid R observations required.",
            "category": "MODEL_ESTIMATE",
        }
    if account_equity <= ZERO or risk_per_trade_pct <= ZERO:
        return {
            "available": False,
            "reason": "Account equity and risk per trade must be positive.",
            "category": "MODEL_ESTIMATE",
        }

    simulations = min(max(simulations, 100), MAX_SIMULATIONS)
    future_trades = min(max(future_trades, 1), MAX_FUTURE_TRADES)
    rng = random.Random(seed)

    start = float(account_equity)
    risk_pct = float(risk_per_trade_pct)
    ruin_pct = float(ruin_drawdown_pct)

    ruin_count = 0
    max_dds: list[float] = []

    for _ in range(simulations):
        _ending, max_dd_pct, ruined = _simulate_equity_path(
            xs,
            starting_equity=start,
            risk_pct=risk_pct,
            future_trades=future_trades,
            rng=rng,
        )
        max_dds.append(max_dd_pct)
        if ruined or max_dd_pct >= ruin_pct:
            ruin_count += 1

    max_dds.sort()
    prob = ruin_count / simulations * 100

    return {
        "available": True,
        "category": "MODEL_ESTIMATE",
        "assumptions": {
            "account_equity": money(account_equity),
            "risk_per_trade_pct": ratio(risk_per_trade_pct),
            "ruin_drawdown_pct": ratio(ruin_drawdown_pct),
            "simulations": simulations,
            "future_trades": future_trades,
            "method": "Historical R-multiples resampled with replacement; fixed % risk compounding on equity.",
        },
        "estimated_probability_pct": ratio(Decimal(str(prob))),
        "simulations": simulations,
        "crossings": ruin_count,
        "drawdown_percentiles": {
            "p50": ratio(Decimal(str(_pct(max_dds, 0.50)))),
            "p75": ratio(Decimal(str(_pct(max_dds, 0.75)))),
            "p90": ratio(Decimal(str(_pct(max_dds, 0.90)))),
            "p95": ratio(Decimal(str(_pct(max_dds, 0.95)))),
        },
        "historical_sample_size": n,
        "sample": sample_payload(n),
        "disclaimer": (
            "MODEL ESTIMATE — probability of crossing the drawdown threshold under stated assumptions. "
            "Not a guarantee of future risk."
        ),
    }


def _pct(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = int(p * (len(sorted_vals) - 1))
    return sorted_vals[idx]
