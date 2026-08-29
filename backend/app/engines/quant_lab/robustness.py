"""Robustness tests — top-trade removal scenarios."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.bootstrap import bootstrap_expectancy, bootstrap_win_rate
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.sample_policy import sample_payload


def _profit_factor(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    wins = sum((t.net_pnl for t in trades if t.net_pnl > ZERO), ZERO)
    losses = abs(sum((t.net_pnl for t in trades if t.net_pnl < ZERO), ZERO))
    if losses == ZERO:
        return None
    return ratio(wins / losses)


def _without_top(trades: Sequence[AnalyticsTrade], n_remove: int) -> list[AnalyticsTrade]:
    if n_remove <= 0:
        return list(trades)
    ranked = sorted(trades, key=lambda t: t.net_pnl, reverse=True)
    remove_ids = {t.id for t in ranked[:n_remove]}
    return [t for t in trades if t.id not in remove_ids]


def _scenario(label: str, trades: Sequence[AnalyticsTrade]) -> dict:
    exp = build_expectancy(trades)
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    return {
        "label": label,
        "n": len(trades),
        "expectancy_r": exp["expectancy_r"],
        "expectancy_currency": exp["expectancy_currency"],
        "profit_factor": _profit_factor(trades),
        "net_r": ratio(sum(rs, ZERO)) if rs else None,
        "net_pnl": money(sum((t.net_pnl for t in trades), ZERO)),
    }


def build_top_trade_removal(trades: Sequence[AnalyticsTrade]) -> dict:
    scenarios = [
        _scenario("All trades", trades),
        _scenario("Without top 1", _without_top(trades, 1)),
        _scenario("Without top 3", _without_top(trades, 3)),
        _scenario("Without top 5", _without_top(trades, 5)),
    ]
    return {
        "scenarios": scenarios,
        "label": "ROBUSTNESS TEST",
        "disclaimer": (
            "Removing top trades shows sensitivity to exceptional outcomes. "
            "This is a research observation — not a prediction."
        ),
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(trades)),
    }


def build_bootstrap_robustness(trades: Sequence[AnalyticsTrade], *, iterations: int = 5000, seed: int = 42) -> dict:
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    pnls = [t.net_pnl for t in trades]
    wins = [Decimal("1") if t.classify_outcome() == "win" else Decimal("0") for t in trades]
    exp_boot = bootstrap_expectancy(rs, iterations=iterations, seed=seed) if rs else bootstrap_expectancy([])
    pnl_boot = bootstrap_expectancy(pnls, iterations=iterations, seed=seed + 1) if pnls else bootstrap_expectancy([])
    wr_boot = bootstrap_win_rate(wins, iterations=iterations, seed=seed + 2) if wins else bootstrap_win_rate([])
    observed_wr = ratio(sum(wins, ZERO) / Decimal(len(wins)) * Decimal("100")) if wins else None

    return {
        "expectancy_r": {
            "observed": exp_boot["point_estimate"],
            "bootstrap_median": exp_boot["median"],
            "confidence_interval": exp_boot["confidence_interval"],
            "histogram": exp_boot.get("histogram", []),
            "available": exp_boot["available"],
            "category": "BOOTSTRAPPED_ESTIMATE",
        },
        "average_return": {
            "observed": pnl_boot["point_estimate"],
            "bootstrap_median": pnl_boot["median"],
            "confidence_interval": pnl_boot["confidence_interval"],
            "available": pnl_boot["available"],
            "category": "BOOTSTRAPPED_ESTIMATE",
        },
        "win_rate": {
            "observed": observed_wr,
            "bootstrap_median": wr_boot["median"],
            "confidence_interval": wr_boot["confidence_interval"],
            "available": wr_boot["available"],
            "category": "BOOTSTRAPPED_ESTIMATE",
        },
        "iterations": iterations,
        "seed": seed,
        "note": "Bootstrap resampling estimates uncertainty around observed metrics.",
        "sample": sample_payload(len(trades)),
    }
