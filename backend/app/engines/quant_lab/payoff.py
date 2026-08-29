"""Payoff ratio analysis."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.sample_policy import sample_payload


def build_payoff(trades: Sequence[AnalyticsTrade]) -> dict:
    wins = [t for t in trades if t.classify_outcome() == "win"]
    losses = [t for t in trades if t.classify_outcome() == "loss"]
    avg_win = sum((t.net_pnl for t in wins), ZERO) / Decimal(len(wins)) if wins else None
    avg_loss = sum((t.net_pnl for t in losses), ZERO) / Decimal(len(losses)) if losses else None

    payoff_currency = None
    note = None
    if not losses:
        note = "No losing trades in sample — payoff ratio not available."
    elif avg_loss is not None and avg_loss != ZERO and avg_win is not None:
        payoff_currency = ratio(avg_win / abs(avg_loss))

    win_rs = [t.r_multiple for t in wins if t.r_multiple is not None]
    loss_rs = [t.r_multiple for t in losses if t.r_multiple is not None]
    payoff_r = None
    if win_rs and loss_rs:
        aw = sum(win_rs, ZERO) / Decimal(len(win_rs))
        al = sum(loss_rs, ZERO) / Decimal(len(loss_rs))
        if al != ZERO:
            payoff_r = ratio(aw / abs(al))

    return {
        "payoff_ratio_currency": payoff_currency,
        "payoff_ratio_r": payoff_r,
        "average_win": money(avg_win) if avg_win is not None else None,
        "average_loss": money(avg_loss) if avg_loss is not None else None,
        "note": note,
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(trades)),
        "formula": "Average winning trade / |average losing trade|",
    }
