"""Edge Explorer analytics — instrument, setup, session, time-of-day."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Callable, Sequence
from zoneinfo import ZoneInfo

from app.core.time import as_utc
from app.engines.analytics_lab.sample_rules import MIN_SAMPLE_SIZE_DISPLAY, sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades
from app.engines.fx_math import ZERO, money, ratio


def _bucket_metrics(trades: list[AnalyticsTrade]) -> dict:
    n = len(trades)
    if n == 0:
        return {"n": 0, "sample_note": sample_note(0)}
    wins = [t for t in trades if t.classify_outcome() == "win"]
    win_pnls = [t.net_pnl for t in wins]
    loss_pnls = [t.net_pnl for t in trades if t.classify_outcome() == "loss"]
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    gp = sum(win_pnls, ZERO)
    gl = abs(sum(loss_pnls, ZERO))
    pf = ratio(gp / gl) if gl > ZERO else None
    net = sum((t.net_pnl for t in trades), ZERO)
    net_r = sum(rs, ZERO) if rs else None
    holds = [t.holding_time_seconds for t in trades if t.holding_time_seconds is not None]
    risks = [t.risk_amount for t in trades if t.risk_amount > ZERO]
    gross = sum((t.gross_pnl for t in trades), ZERO)
    return {
        "n": n,
        "net_pnl": money(net),
        "gross_pnl": money(gross),
        "net_r": ratio(net_r) if net_r is not None else None,
        "win_rate": ratio(Decimal(len(wins)) / Decimal(n) * 100),
        "average_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "expectancy_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "expectancy_currency": money(net / Decimal(n)),
        "profit_factor": pf,
        "average_holding_seconds": int(sum(holds) / len(holds)) if holds else None,
        "average_risk": money(sum(risks, ZERO) / Decimal(len(risks))) if risks else None,
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
        "sample_label": "insufficient" if n < MIN_SAMPLE_SIZE_DISPLAY else "low" if n < 20 else "standard",
    }


def _leaderboard(
    trades: Sequence[AnalyticsTrade],
    key_fn: Callable[[AnalyticsTrade], str],
    *,
    label: str,
) -> list[dict]:
    buckets: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in closed_trades(list(trades)):
        buckets[key_fn(t)].append(t)
    rows = []
    for key, items in buckets.items():
        m = _bucket_metrics(items)
        rows.append({"key": key, "label": label, **m})
    rows.sort(key=lambda r: (Decimal(str(r["net_r"] or 0)), r["n"]), reverse=True)
    return rows


def build_edge(trades: Sequence[AnalyticsTrade], timezone: str) -> dict:
    tz = ZoneInfo(timezone)
    instruments = _leaderboard(trades, lambda t: t.symbol, label="instrument")
    setups = _leaderboard(trades, lambda t: t.setup or "unclassified", label="setup")
    sessions = _leaderboard(trades, lambda t: t.session, label="session")

    hour_buckets: dict[int, list[AnalyticsTrade]] = defaultdict(list)
    heatmap: dict[str, dict[int, list[AnalyticsTrade]]] = defaultdict(lambda: defaultdict(list))
    for t in closed_trades(list(trades)):
        local = as_utc(t.entry_at).astimezone(tz)
        hour_buckets[local.hour].append(t)
        weekday = local.strftime("%A")
        heatmap[weekday][local.hour].append(t)

    by_hour = []
    for hour in range(24):
        items = hour_buckets.get(hour, [])
        m = _bucket_metrics(items)
        by_hour.append({"hour": hour, **m})

    heatmap_cells = []
    for day, hours in sorted(heatmap.items()):
        for hour, items in hours.items():
            m = _bucket_metrics(items)
            heatmap_cells.append({"day": day, "hour": hour, **m})

    return {
        "instruments": instruments,
        "setups": setups,
        "sessions": sessions,
        "time_of_day": {
            "timezone": timezone,
            "by_hour": by_hour,
            "heatmap": heatmap_cells,
            "metric": "expectancy_r",
        },
    }
