"""Streak and sequence analytics — descriptive only."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.core.enums import TradeResult
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, journal_rows, ordered_closed
from app.engines.analytics_views import dump_perf_group, streak_histogram
from app.engines.fx_math import ZERO, money, ratio


def _after_consecutive(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    kind: TradeResult,
    threshold: int,
    label: str,
) -> dict:
    ordered = journal_rows(ordered_closed(trades))
    selected = []
    run = 0
    for i, t in enumerate(ordered):
        if i > 0 and run >= threshold:
            selected.append(t)
        if t.result == kind:
            run += 1
        else:
            run = 0
    key = f"after_{threshold}_{'wins' if kind == TradeResult.WIN else 'losses'}"
    row = dump_perf_group(key, selected, starting, label)
    row["threshold"] = threshold
    row["disclaimer"] = (
        f"Historically, the next trade following {threshold} consecutive "
        f"{'wins' if kind == TradeResult.WIN else 'losses'} had the metrics below. "
        "Descriptive only — not predictive."
    )
    return row


def _streak_averages(hist: dict) -> dict:
    def avg(dist: list[dict]) -> Decimal | None:
        if not dist:
            return None
        total = sum(e["length"] * e["occurrences"] for e in dist)
        count = sum(e["occurrences"] for e in dist)
        return ratio(Decimal(total) / Decimal(count)) if count else None

    return {
        "average_win_streak": avg(hist.get("win_distribution", [])),
        "average_loss_streak": avg(hist.get("loss_distribution", [])),
    }


def build_streaks_analytics(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    journals = journal_rows(trades)
    hist = streak_histogram(journals)
    avgs = _streak_averages(hist)
    ordered = ordered_closed(trades)
    n = len(ordered)

    after_patterns = [
        _after_consecutive(trades, starting=starting, kind=TradeResult.LOSS, threshold=2, label="After consecutive losses"),
        _after_consecutive(trades, starting=starting, kind=TradeResult.LOSS, threshold=3, label="After consecutive losses"),
        _after_consecutive(trades, starting=starting, kind=TradeResult.WIN, threshold=2, label="After consecutive wins"),
        _after_consecutive(trades, starting=starting, kind=TradeResult.WIN, threshold=3, label="After consecutive wins"),
    ]

    return {
        "current": {
            "wins": hist["current_wins"],
            "losses": hist["current_losses"],
        },
        "longest": {
            "wins": hist["longest_wins"],
            "losses": hist["longest_losses"],
        },
        "averages": avgs,
        "loss_distribution": hist["loss_distribution"],
        "win_distribution": hist["win_distribution"],
        "after_streaks": after_patterns,
        "breakeven_rule": "Breakeven trades (|net_pnl| ≤ 0.01) break both win and loss streaks.",
        "n": n,
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
    }
