"""Streak analytics wrapper for Quant Lab."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.streaks import build_streaks_analytics
from app.engines.analytics_lab.trade_row import AnalyticsTrade, journal_rows, ordered_closed
from app.engines.analytics_views import streak_histogram
from app.engines.fx_math import ratio


def build_quant_streaks(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    base = build_streaks_analytics(trades, starting=starting)
    hist = streak_histogram(journal_rows(ordered_closed(trades)))
    loss_dist = hist.get("loss_distribution", [])
    total_loss_streaks = sum(e["occurrences"] for e in loss_dist)
    distribution = []
    for e in loss_dist:
        length = e["length"]
        occ = e["occurrences"]
        distribution.append(
            {
                "length": length,
                "label": f"{length} Loss{'es' if length != 1 else ''}" if length < 4 else "4+ Losses",
                "occurrences": occ,
                "frequency_pct": ratio(Decimal(occ) / Decimal(total_loss_streaks) * Decimal("100"))
                if total_loss_streaks
                else None,
            }
        )
    return {
        **base,
        "loss_streak_distribution": distribution,
        "category": "OBSERVED_PERFORMANCE",
    }
