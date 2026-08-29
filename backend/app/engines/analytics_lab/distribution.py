"""P&L / R distributions, expectancy, and daily performance buckets."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.time import as_utc
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import r_distribution
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import _stdev_sample

DEFAULT_DAILY_R_BUCKETS = [
    ("< -2R", None, Decimal("-2")),
    ("-2R to -1R", Decimal("-2"), Decimal("-1")),
    ("-1R to 0R", Decimal("-1"), Decimal("0")),
    ("0R to +1R", Decimal("0"), Decimal("1")),
    ("+1R to +2R", Decimal("1"), Decimal("2")),
    ("> +2R", Decimal("2"), None),
]


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
    d0 = sorted_vals[f] * Decimal(str(c - k))
    d1 = sorted_vals[c] * Decimal(str(k - f))
    return d0 + d1


def _distribution_stats(values: list[Decimal]) -> dict:
    if not values:
        return {
            "n": 0,
            "mean": None,
            "median": None,
            "stdev": None,
            "min": None,
            "max": None,
            "percentiles": {},
            "evidence": with_evidence(0),
            "sample_note": sample_note(0),
        }
    xs = sorted(values)
    mu = sum(values, ZERO) / Decimal(len(values))
    return {
        "n": len(values),
        "mean": money(mu),
        "median": money(Decimal(str(median([float(v) for v in xs])))),
        "stdev": ratio(_stdev_sample(values)) if len(values) >= 2 else None,
        "min": money(xs[0]),
        "max": money(xs[-1]),
        "percentiles": {
            "p10": money(_percentile(xs, 0.10)),
            "p25": money(_percentile(xs, 0.25)),
            "p50": money(_percentile(xs, 0.50)),
            "p75": money(_percentile(xs, 0.75)),
            "p90": money(_percentile(xs, 0.90)),
        },
        "evidence": with_evidence(len(values)),
        "sample_note": sample_note(len(values)),
    }


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


def _daily_groups(trades: Sequence[AnalyticsTrade], timezone: str) -> dict:
    tz = ZoneInfo(timezone)
    by_day: dict = defaultdict(list)
    for t in closed_trades(list(trades)):
        day = as_utc(t.exit_at or t.entry_at).astimezone(tz).date()
        by_day[day].append(t)
    return by_day


def _daily_r_bucket(day_r: Decimal, buckets=DEFAULT_DAILY_R_BUCKETS) -> str:
    for label, lo, hi in buckets:
        if lo is not None and day_r < lo:
            continue
        if hi is not None and day_r >= hi:
            continue
        return label
    return buckets[-1][0]


def _expectancy_block(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    wins = [t for t in closed if t.classify_outcome() == "win"]
    losses = [t for t in closed if t.classify_outcome() == "loss"]
    breakevens = [t for t in closed if t.classify_outcome() == "breakeven"]
    win_rate = Decimal(len(wins)) / Decimal(n) if n else ZERO
    loss_rate = Decimal(len(losses)) / Decimal(n) if n else ZERO
    avg_win = sum((t.net_pnl for t in wins), ZERO) / Decimal(len(wins)) if wins else None
    avg_loss = sum((t.net_pnl for t in losses), ZERO) / Decimal(len(losses)) if losses else None
    expectancy_currency = None
    if n:
        win_component = win_rate * (avg_win or ZERO)
        loss_component = loss_rate * abs(avg_loss or ZERO)
        expectancy_currency = money(win_component - loss_component)
    rs = [t.r_multiple for t in closed if t.r_multiple is not None]
    expectancy_r = ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None
    return {
        "n": n,
        "win_rate": ratio(win_rate * Decimal("100")) if n else None,
        "loss_rate": ratio(loss_rate * Decimal("100")) if n else None,
        "breakevens": len(breakevens),
        "average_win": money(avg_win) if avg_win is not None else None,
        "average_loss": money(avg_loss) if avg_loss is not None else None,
        "expectancy_currency": expectancy_currency,
        "expectancy_r": expectancy_r,
        "average_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "median_r": ratio(Decimal(str(median([float(r) for r in rs])))) if rs else None,
        "total_r": ratio(sum(rs, ZERO)) if rs else None,
        "valid_r_observations": len(rs),
        "missing_r": n - len(rs),
        "formula": {
            "currency": "(win_rate × average_win) - (loss_rate × |average_loss|)",
            "r": "sum(R_multiple) / number_of_trades_with_valid_R",
        },
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
    }


def build_distributions(trades: Sequence[AnalyticsTrade], *, timezone: str) -> dict:
    closed = closed_trades(list(trades))
    journals = journal_rows(closed)
    pnls = [t.net_pnl for t in closed]
    rs = [t.r_multiple for t in closed if t.r_multiple is not None]

    by_day = _daily_groups(trades, timezone)
    daily_pnls: list[Decimal] = []
    daily_rs: list[Decimal] = []
    for _day, items in by_day.items():
        daily_pnls.append(sum((t.net_pnl for t in items), ZERO))
        day_rs = [t.r_multiple for t in items if t.r_multiple is not None]
        if day_rs:
            daily_rs.append(sum(day_rs, ZERO))

    profitable_days = sum(1 for p in daily_pnls if p > ZERO)
    losing_days = sum(1 for p in daily_pnls if p < ZERO)
    flat_days = sum(1 for p in daily_pnls if p == ZERO)

    r_bucket_counts: dict[str, int] = defaultdict(int)
    for day_r in daily_rs:
        r_bucket_counts[_daily_r_bucket(day_r)] += 1

    return {
        "trade_pnl": {
            **_distribution_stats(pnls),
            "histogram": _histogram([float(p) for p in pnls]),
        },
        "r_multiple": r_distribution(journals),
        "daily_pnl": {
            **_distribution_stats(daily_pnls),
            "trading_days": len(daily_pnls),
            "profitable_days": profitable_days,
            "losing_days": losing_days,
            "flat_days": flat_days,
            "histogram": _histogram([float(p) for p in daily_pnls]),
        },
        "daily_r_buckets": {
            "buckets": [
                {"label": label, "n": r_bucket_counts.get(label, 0)}
                for label, _lo, _hi in DEFAULT_DAILY_R_BUCKETS
            ],
            "trading_days_with_r": len(daily_rs),
            "missing_r_days": max(0, len(by_day) - len(daily_rs)),
            "evidence": with_evidence(len(daily_rs)),
            "sample_note": sample_note(len(daily_rs)),
        },
        "expectancy": _expectancy_block(trades),
    }
