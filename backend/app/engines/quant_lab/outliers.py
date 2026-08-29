"""Outlier dependency — concentration of profit in top trades."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.sample_policy import sample_payload

# Configurable dependency thresholds (top-5 share of positive net profit)
LOW_MAX_PCT = Decimal("25")
MODERATE_MAX_PCT = Decimal("50")


def _profit_factor(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    wins = sum((t.net_pnl for t in trades if t.net_pnl > ZERO), ZERO)
    losses = abs(sum((t.net_pnl for t in trades if t.net_pnl < ZERO), ZERO))
    if losses == ZERO:
        return None
    return ratio(wins / losses)


def _dependency_level(pct: Decimal | None) -> str | None:
    if pct is None:
        return None
    if pct <= LOW_MAX_PCT:
        return "LOW"
    if pct <= MODERATE_MAX_PCT:
        return "MODERATE"
    return "HIGH"


def _without_top(trades: Sequence[AnalyticsTrade], n_remove: int) -> list[AnalyticsTrade]:
    if n_remove <= 0:
        return list(trades)
    ranked = sorted(trades, key=lambda t: t.net_pnl, reverse=True)
    remove_ids = {t.id for t in ranked[:n_remove]}
    return [t for t in trades if t.id not in remove_ids]


def _scenario_metrics(trades: Sequence[AnalyticsTrade]) -> dict:
    exp = build_expectancy(trades)
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    return {
        "n": len(trades),
        "net_pnl": money(sum((t.net_pnl for t in trades), ZERO)),
        "net_r": ratio(sum(rs, ZERO)) if rs else None,
        "expectancy_r": exp["expectancy_r"],
        "expectancy_currency": exp["expectancy_currency"],
        "profit_factor": _profit_factor(trades),
        "win_rate": exp["win_rate"],
    }


def build_outlier_dependency(trades: Sequence[AnalyticsTrade]) -> dict:
    n = len(trades)
    net = sum((t.net_pnl for t in trades), ZERO)
    ranked = sorted(trades, key=lambda t: t.net_pnl, reverse=True)

    def contribution(top_n: int) -> Decimal | None:
        if net <= ZERO or top_n <= 0:
            return None
        top_sum = sum((t.net_pnl for t in ranked[:top_n]), ZERO)
        if top_sum <= ZERO:
            return Decimal("0")
        return ratio(top_sum / net * Decimal("100"))

    top10_count = max(1, int(n * 0.10)) if n else 0
    top5_pct = contribution(5)

    without = {
        "without_top_1": _scenario_metrics(_without_top(trades, 1)),
        "without_top_3": _scenario_metrics(_without_top(trades, 3)),
        "without_top_5": _scenario_metrics(_without_top(trades, 5)),
    }

    return {
        "total_net_profit": money(net),
        "contributions": {
            "top_1": {
                "amount": money(ranked[0].net_pnl) if ranked else None,
                "pct_of_net_profit": contribution(1),
            },
            "top_3": {
                "amount": money(sum((t.net_pnl for t in ranked[:3]), ZERO)) if n >= 3 else None,
                "pct_of_net_profit": contribution(3),
            },
            "top_5": {
                "amount": money(sum((t.net_pnl for t in ranked[:5]), ZERO)) if n >= 5 else None,
                "pct_of_net_profit": top5_pct,
            },
            "top_10pct": {
                "trade_count": top10_count,
                "amount": money(sum((t.net_pnl for t in ranked[:top10_count]), ZERO)) if top10_count else None,
                "pct_of_net_profit": contribution(top10_count),
            },
        },
        "profit_dependency_top_5_pct": top5_pct,
        "dependency_level": _dependency_level(top5_pct),
        "thresholds": {
            "low_max_pct": str(LOW_MAX_PCT),
            "moderate_max_pct": str(MODERATE_MAX_PCT),
            "note": "Based on share of total net profit from top 5 trades.",
        },
        "performance_without_outliers": without,
        "disclaimer": (
            "Outlier dependency is descriptive. Some strategies legitimately depend on large winners. "
            "This is not inherently negative."
        ),
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(n),
    }
