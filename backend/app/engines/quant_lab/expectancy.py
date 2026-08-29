"""Expectancy decomposition — deterministic."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.sample_policy import sample_payload


def build_expectancy(trades: Sequence[AnalyticsTrade]) -> dict:
    n = len(trades)
    wins = [t for t in trades if t.classify_outcome() == "win"]
    losses = [t for t in trades if t.classify_outcome() == "loss"]
    bes = [t for t in trades if t.classify_outcome() == "breakeven"]

    win_rate = Decimal(len(wins)) / Decimal(n) if n else ZERO
    loss_rate = Decimal(len(losses)) / Decimal(n) if n else ZERO
    be_rate = Decimal(len(bes)) / Decimal(n) if n else ZERO

    avg_win = sum((t.net_pnl for t in wins), ZERO) / Decimal(len(wins)) if wins else None
    avg_loss = sum((t.net_pnl for t in losses), ZERO) / Decimal(len(losses)) if losses else None

    expectancy_currency = None
    if n and avg_win is not None and avg_loss is not None:
        expectancy_currency = money(win_rate * avg_win - loss_rate * abs(avg_loss))
    elif n and avg_win is not None and not losses:
        expectancy_currency = money(win_rate * avg_win)

    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    expectancy_r = ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None

    return {
        "n": n,
        "win_rate": ratio(win_rate * Decimal("100")) if n else None,
        "loss_rate": ratio(loss_rate * Decimal("100")) if n else None,
        "breakeven_rate": ratio(be_rate * Decimal("100")) if n else None,
        "wins": len(wins),
        "losses": len(losses),
        "breakevens": len(bes),
        "average_win": money(avg_win) if avg_win is not None else None,
        "average_loss": money(avg_loss) if avg_loss is not None else None,
        "expectancy_currency": expectancy_currency,
        "expectancy_r": expectancy_r,
        "valid_r_observations": len(rs),
        "formula": {
            "currency": "(win_rate × average_win) − (loss_rate × |average_loss|)",
            "r": "sum(R) / n with valid R",
        },
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(n, metric="Expectancy"),
    }
