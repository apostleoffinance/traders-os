"""Calendar, period, and temporal performance analytics."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.time import as_utc
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group, group_stats, monthly_bars, r_of
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import _stdev_sample, compute_performance
from app.core.enums import TradeStatus
from app.engines.risk_engine import ClosedTrade

WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def _enhanced_calendar(trades: Sequence[AnalyticsTrade], timezone: str) -> list[dict]:
    tz = ZoneInfo(timezone)
    by_day: dict = defaultdict(list)
    for t in closed_trades(list(trades)):
        day = as_utc(t.exit_at or t.entry_at).astimezone(tz).date()
        by_day[day].append(t)
    rows = []
    for day, items in sorted(by_day.items()):
        rs = [t.r_multiple for t in items if t.r_multiple is not None]
        net = sum((t.net_pnl for t in items), ZERO)
        gross = sum((t.gross_pnl for t in items), ZERO)
        wins = sum(1 for t in items if t.classify_outcome() == "win")
        losses = sum(1 for t in items if t.classify_outcome() == "loss")
        rows.append(
            {
                "date": day.isoformat(),
                "n": len(items),
                "net_pnl": money(net),
                "gross_pnl": money(gross),
                "r": ratio(sum(rs, ZERO)) if rs else None,
                "wins": wins,
                "losses": losses,
                "record": f"{wins}W-{losses}L",
            }
        )
    return rows


def _week_of_month(trades: Sequence[AnalyticsTrade], timezone: str, starting: Decimal) -> list[dict]:
    tz = ZoneInfo(timezone)
    buckets: dict[str, list] = defaultdict(list)
    for t in closed_trades(list(trades)):
        local = as_utc(t.exit_at or t.entry_at).astimezone(tz)
        week = min(5, (local.day - 1) // 7 + 1)
        buckets[f"Week {week}"].append(t)
    out = []
    for key in [f"Week {i}" for i in range(1, 6)]:
        items = buckets.get(key, [])
        if not items:
            out.append({"key": key, "n": 0, "net_pnl": None, "win_rate": None, "average_r": None})
            continue
        journals = journal_rows(items)
        row = dump_perf_group(key, journals, starting, "Week of month")
        out.append(
            {
                "key": key,
                "n": row["n"],
                "net_pnl": row["net_pnl"],
                "win_rate": row["win_rate"],
                "average_r": row["average_r"],
                "evidence": row["evidence"],
            }
        )
    return out


def _monthly_summary(monthly: list[dict]) -> dict:
    if not monthly:
        return {
            "best_month": None,
            "worst_month": None,
            "average_monthly_pnl": None,
            "positive_month_pct": None,
            "monthly_volatility": None,
        }
    pnls = [Decimal(str(m["net_pnl"])) for m in monthly if m.get("net_pnl") is not None]
    positive = sum(1 for p in pnls if p > ZERO)
    return {
        "best_month": max(monthly, key=lambda m: Decimal(str(m.get("net_pnl") or 0))),
        "worst_month": min(monthly, key=lambda m: Decimal(str(m.get("net_pnl") or 0))),
        "average_monthly_pnl": money(sum(pnls, ZERO) / Decimal(len(pnls))) if pnls else None,
        "positive_month_pct": ratio(Decimal(positive) / Decimal(len(pnls)) * Decimal("100")) if pnls else None,
        "monthly_volatility": ratio(_stdev_sample(pnls)) if len(pnls) >= 2 else None,
    }


def _period_metrics(trades: Sequence[AnalyticsTrade], starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    views = [
        ClosedTrade(
            id=t.id,
            entry_at=t.entry_at,
            exit_at=t.exit_at,
            risk_amount=t.risk_amount,
            realized_pnl=t.net_pnl,
            result=t.result,
            status=TradeStatus.CLOSED,
        )
        for t in closed
    ]
    perf = compute_performance(views, starting)
    rs = [t.r_multiple for t in closed if t.r_multiple is not None]
    return {
        "n_trades": perf.n_trades,
        "net_pnl": perf.net_pnl,
        "win_rate": perf.win_rate,
        "profit_factor": perf.profit_factor,
        "expectancy_r": perf.expectancy_r,
        "average_r": perf.average_r,
        "max_drawdown": perf.max_drawdown,
        "total_r": ratio(sum(rs, ZERO)) if rs else None,
    }


def _compare(current: dict, previous: dict) -> list[dict]:
    metrics = [
        ("trades", "n_trades", "trades"),
        ("net_pnl", "net_pnl", "currency"),
        ("win_rate", "win_rate", "%"),
        ("profit_factor", "profit_factor", "ratio"),
        ("expectancy_r", "expectancy_r", "R"),
        ("average_r", "average_r", "R"),
        ("max_drawdown", "max_drawdown", "currency"),
    ]
    rows = []
    for label, key, unit in metrics:
        cur = current.get(key)
        prev = previous.get(key)
        change = None
        if cur is not None and prev is not None:
            try:
                change = ratio(Decimal(str(cur)) - Decimal(str(prev)))
            except Exception:
                change = None
        rows.append({"metric": label, "current": cur, "previous": prev, "change": change, "unit": unit})
    return rows


def build_temporal(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    timezone: str,
    previous_trades: Sequence[AnalyticsTrade] | None = None,
) -> dict:
    journals = journal_rows(trades)
    calendar = _enhanced_calendar(trades, timezone)
    weekday = group_stats(journals, starting, lambda t: as_utc(t.entry_at).astimezone(ZoneInfo(timezone)).strftime("%A"), "Weekday")
    weekday_ordered = []
    by_name = {w["key"]: w for w in weekday}
    for name in WEEKDAYS:
        weekday_ordered.append(by_name.get(name, {"key": name, "n": 0, "net_pnl": None, "win_rate": None}))
    monthly = monthly_bars(journals, starting, timezone)
    monthly_table = [
        {
            "month": m["month"],
            "n": m["n"],
            "win_rate": m["win_rate"],
            "net_pnl": m["net_pnl"],
            "r": m.get("expectancy_r"),
            "profit_factor": m["profit_factor"],
            "evidence": m["evidence"],
        }
        for m in monthly
    ]

    current = _period_metrics(trades, starting)
    previous = _period_metrics(previous_trades or [], starting) if previous_trades else None

    return {
        "calendar": {
            "days": calendar,
            "default_metric": "daily_net_r",
            "metrics": ["net_pnl", "r", "trade_count"],
            "timezone": timezone,
            "evidence": with_evidence(len(calendar)),
        },
        "weekday": weekday_ordered,
        "week_of_month": _week_of_month(trades, timezone, starting),
        "monthly": {
            "rows": monthly_table,
            "summary": _monthly_summary(monthly_table),
            "evidence": with_evidence(len(monthly_table)),
        },
        "period_comparison": {
            "available": previous is not None and previous["n_trades"] > 0,
            "current": current,
            "previous": previous,
            "comparison": _compare(current, previous or {}) if previous else [],
            "disclaimer": "Period comparison is descriptive. Differences may reflect sample size and market conditions.",
            "evidence": with_evidence(current["n_trades"]),
        },
        "sample_note": sample_note(len(closed_trades(list(trades)))),
    }
