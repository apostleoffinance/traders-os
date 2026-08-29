"""Performance consistency scorecard."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.time import as_utc
from app.engines.analytics_lab.distribution import _daily_groups, build_distributions
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import consistency
from app.engines.fx_math import ZERO, ratio
from app.engines.performance_engine import _stdev_sample


def build_consistency_scorecard(trades: Sequence[AnalyticsTrade], *, timezone: str) -> dict:
    journals = journal_rows(trades)
    base = consistency(journals, timezone)
    dist = build_distributions(trades, timezone=timezone)
    daily = dist["daily_pnl"]

    tz = ZoneInfo(timezone)
    month_buckets: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for t in closed_trades(list(trades)):
        local = as_utc(t.exit_at or t.entry_at).astimezone(tz)
        key = f"{local.year:04d}-{local.month:02d}"
        month_buckets[key] += t.net_pnl

    positive_months = sum(1 for v in month_buckets.values() if v > ZERO)
    total_months = len(month_buckets)
    winning_weeks = base.get("profitable_weeks", 0)
    total_weeks = base.get("weeks", 0)

    by_day = _daily_groups(trades, timezone)
    daily_pnls = [sum((t.net_pnl for t in items), ZERO) for items in by_day.values()]

    return {
        "winning_days_pct": base.get("profitable_day_pct"),
        "winning_weeks_pct": ratio(Decimal(winning_weeks) / Decimal(total_weeks) * Decimal("100")) if total_weeks else None,
        "positive_months_pct": ratio(Decimal(positive_months) / Decimal(total_months) * Decimal("100")) if total_months else None,
        "trading_days": daily.get("trading_days", 0),
        "profitable_days": daily.get("profitable_days", 0),
        "losing_days": daily.get("losing_days", 0),
        "flat_days": daily.get("flat_days", 0),
        "average_daily_pnl": daily.get("mean"),
        "median_daily_pnl": daily.get("median"),
        "daily_pnl_volatility": daily.get("stdev"),
        "largest_winning_day": daily.get("max"),
        "largest_losing_day": daily.get("min"),
        "average_daily_r": base.get("average_daily_r"),
        "median_daily_r": base.get("median_daily_r"),
        "stdev_daily_r": base.get("stdev_daily_r"),
        "best_day": base.get("best_day"),
        "worst_day": base.get("worst_day"),
        "winning_weeks": winning_weeks,
        "losing_weeks": base.get("losing_weeks", 0),
        "positive_months": positive_months,
        "total_months": total_months,
        "note": "Underlying consistency metrics — no proprietary composite score.",
        "evidence": with_evidence(len(daily_pnls)),
        "sample_note": sample_note(len(daily_pnls)),
    }
