"""Pure analytics views over journal trades. No SQL, no React, no LLM."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from statistics import median
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.enums import TradeResult, TradeStatus
from app.core.time import as_utc
from app.engines.evidence import evidence_payload
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import MIN_INSIGHT_N, compute_performance
from app.engines.risk_engine import ClosedTrade, EquityPoint, consecutive_results


@dataclass(frozen=True)
class JournalTrade:
    id: str
    symbol: str
    session: str
    setup: str
    direction: str
    timeframe: str
    result: TradeResult
    status: TradeStatus
    entry_at: datetime
    exit_at: datetime | None
    risk_amount: Decimal
    risk_percent: Decimal
    realized_pnl: Decimal
    realized_r: Decimal | None
    holding_time_seconds: int | None
    emotion_before: str | None
    discipline_score: int | None


def to_closed(t: JournalTrade) -> ClosedTrade:
    return ClosedTrade(
        id=t.id,
        entry_at=t.entry_at,
        exit_at=t.exit_at,
        risk_amount=t.risk_amount,
        realized_pnl=t.realized_pnl,
        result=t.result,
        status=t.status,
    )


def closed_only(trades: Sequence[JournalTrade]) -> list[JournalTrade]:
    return [t for t in trades if t.status == TradeStatus.CLOSED]


def r_of(t: JournalTrade) -> Decimal | None:
    if t.realized_r is not None:
        return t.realized_r
    if t.risk_amount > ZERO:
        return t.realized_pnl / t.risk_amount
    return None


def _ordered(trades: Sequence[JournalTrade]) -> list[JournalTrade]:
    return sorted(closed_only(trades), key=lambda t: as_utc(t.exit_at or t.entry_at))


def dump_perf_group(key: str, items: Sequence[JournalTrade], starting: Decimal, label: str) -> dict:
    m = compute_performance([to_closed(t) for t in items], starting)
    ev = evidence_payload(m.n_trades)
    insight = f"n={m.n_trades} — insufficient for inference."
    if m.n_trades >= MIN_INSIGHT_N and m.expectancy_r is not None:
        insight = (
            f"{label} '{key}' expectancy {m.expectancy_r}R over {m.n_trades} trades. Descriptive only."
        )
    return {
        "key": key,
        "n": m.n_trades,
        "net_pnl": m.net_pnl,
        "expectancy_r": m.expectancy_r,
        "win_rate": m.win_rate,
        "average_r": m.average_r,
        "profit_factor": m.profit_factor,
        "insight": insight,
        "evidence": ev,
    }


def group_stats(trades: Sequence[JournalTrade], starting: Decimal, key_fn, label: str) -> list[dict]:
    buckets: dict[str, list[JournalTrade]] = defaultdict(list)
    for t in closed_only(trades):
        buckets[str(key_fn(t))].append(t)
    return [
        dump_perf_group(key, items, starting, label)
        for key, items in sorted(buckets.items(), key=lambda kv: -len(kv[1]))
    ]


def r_distribution(trades: Sequence[JournalTrade]) -> dict:
    vals = [r_of(t) for t in closed_only(trades)]
    vals = [v for v in vals if v is not None]
    if not vals:
        return {
            "n": 0,
            "mean": None,
            "median": None,
            "min": None,
            "max": None,
            "stdev": None,
            "bins": [],
            "values": [],
            "evidence": evidence_payload(0),
        }
    xs = [float(v) for v in vals]
    lo, hi = min(xs), max(xs)
    n_bins = min(16, max(6, len(xs) // 3 or 6))
    width = (hi - lo) / n_bins if hi != lo else 1.0
    bins = []
    for i in range(n_bins):
        a = lo + i * width
        b = lo + (i + 1) * width
        if i < n_bins - 1:
            count = sum(1 for x in xs if a <= x < b)
        else:
            count = sum(1 for x in xs if a <= x <= hi)
            b = hi
        bins.append({"from": round(a, 4), "to": round(b, 4), "n": count})
    mu = sum(vals, ZERO) / Decimal(len(vals))
    from app.engines.performance_engine import _stdev_sample

    return {
        "n": len(vals),
        "mean": ratio(mu),
        "median": ratio(Decimal(str(median(xs)))),
        "min": ratio(min(vals)),
        "max": ratio(max(vals)),
        "stdev": ratio(_stdev_sample(vals)) if len(vals) >= 2 else None,
        "bins": bins,
        "values": [ratio(v) for v in vals],
        "evidence": evidence_payload(len(vals)),
    }


def frequency_buckets(trades: Sequence[JournalTrade], starting: Decimal, timezone: str) -> list[dict]:
    tz = ZoneInfo(timezone)
    by_day: dict = defaultdict(list)
    for t in closed_only(trades):
        day = as_utc(t.entry_at).astimezone(tz).date()
        by_day[day].append(t)
    groups: dict[str, list[JournalTrade]] = {"1": [], "2": [], "3": [], "4+": []}
    day_counts = {"1": 0, "2": 0, "3": 0, "4+": 0}
    for _day, items in by_day.items():
        n = len(items)
        key = "4+" if n >= 4 else str(n)
        groups[key].extend(items)
        day_counts[key] += 1
    out = []
    for key in ("1", "2", "3", "4+"):
        row = dump_perf_group(key, groups[key], starting, "Trades/day")
        row["trading_days"] = day_counts[key]
        row["label"] = f"{key} trade/day" if key != "4+" else "4+ trades/day"
        out.append(row)
    return out


def risk_scatter(trades: Sequence[JournalTrade]) -> list[dict]:
    out = []
    for t in closed_only(trades):
        r = r_of(t)
        if r is None:
            continue
        out.append(
            {
                "id": t.id,
                "at": as_utc(t.entry_at).isoformat(),
                "symbol": t.symbol,
                "session": t.session,
                "setup": t.setup,
                "risk_percent": t.risk_percent,
                "risk_amount": t.risk_amount,
                "realized_r": r,
                "realized_pnl": t.realized_pnl,
                "result": t.result.value,
            }
        )
    return out


def holding_scatter(trades: Sequence[JournalTrade]) -> list[dict]:
    out = []
    for t in closed_only(trades):
        r = r_of(t)
        if r is None or t.holding_time_seconds is None:
            continue
        out.append(
            {
                "id": t.id,
                "at": as_utc(t.entry_at).isoformat(),
                "setup": t.setup,
                "session": t.session,
                "holding_seconds": t.holding_time_seconds,
                "realized_r": r,
                "result": t.result.value,
            }
        )
    return out


def calendar_days(trades: Sequence[JournalTrade], timezone: str) -> list[dict]:
    tz = ZoneInfo(timezone)
    by_day: dict = defaultdict(list)
    for t in closed_only(trades):
        day = as_utc(t.entry_at).astimezone(tz).date()
        by_day[day].append(t)
    rows = []
    for day, items in sorted(by_day.items()):
        rs = [v for v in (r_of(t) for t in items) if v is not None]
        pnl = sum((t.realized_pnl for t in items), ZERO)
        wins = sum(1 for t in items if t.result == TradeResult.WIN)
        wr = (Decimal(wins) / Decimal(len(items)) * Decimal("100")) if items else None
        rows.append(
            {
                "date": day.isoformat(),
                "n": len(items),
                "net_pnl": money(pnl),
                "r": ratio(sum(rs, ZERO)) if rs else None,
                "win_rate": ratio(wr) if wr is not None else None,
            }
        )
    return rows


def streak_histogram(trades: Sequence[JournalTrade]) -> dict:
    ordered = _ordered(trades)
    loss_hist: dict[int, int] = defaultdict(int)
    win_hist: dict[int, int] = defaultdict(int)
    cur_kind = None
    cur_n = 0

    def flush() -> None:
        nonlocal cur_kind, cur_n
        if cur_kind == TradeResult.LOSS and cur_n:
            loss_hist[cur_n] += 1
        elif cur_kind == TradeResult.WIN and cur_n:
            win_hist[cur_n] += 1

    for t in ordered:
        if t.result in {TradeResult.WIN, TradeResult.LOSS}:
            if t.result == cur_kind:
                cur_n += 1
            else:
                flush()
                cur_kind = t.result
                cur_n = 1
        else:
            flush()
            cur_kind = None
            cur_n = 0
    flush()
    closed = [to_closed(t) for t in ordered]
    consec_l, consec_w = consecutive_results(closed) if closed else (0, 0)
    m = compute_performance(closed, Decimal("1")) if closed else None
    return {
        "current_losses": consec_l,
        "current_wins": consec_w,
        "longest_losses": m.max_consecutive_losses if m else 0,
        "longest_wins": m.max_consecutive_wins if m else 0,
        "loss_distribution": [{"length": k, "occurrences": loss_hist[k]} for k in sorted(loss_hist)],
        "win_distribution": [{"length": k, "occurrences": win_hist[k]} for k in sorted(win_hist)],
        "evidence": evidence_payload(len(ordered)),
    }


def monthly_bars(trades: Sequence[JournalTrade], starting: Decimal, timezone: str) -> list[dict]:
    tz = ZoneInfo(timezone)
    buckets: dict[str, list[JournalTrade]] = defaultdict(list)
    for t in closed_only(trades):
        local = as_utc(t.entry_at).astimezone(tz)
        buckets[f"{local.year:04d}-{local.month:02d}"].append(t)
    out = []
    for key in sorted(buckets):
        row = dump_perf_group(key, buckets[key], starting, "Month")
        row["month"] = key
        out.append(row)
    return out


def rolling_expectancy(trades: Sequence[JournalTrade], window: int = 20) -> list[dict]:
    ordered = _ordered(trades)
    points = []
    for i in range(len(ordered)):
        if i + 1 < min(window, 5):
            continue
        chunk = ordered[max(0, i + 1 - window) : i + 1]
        rs = [v for v in (r_of(t) for t in chunk) if v is not None]
        if not rs:
            continue
        mu = sum(rs, ZERO) / Decimal(len(rs))
        ts = as_utc(chunk[-1].exit_at or chunk[-1].entry_at)
        points.append(
            {
                "at": ts.isoformat(),
                "n": len(rs),
                "expectancy_r": ratio(mu),
                "window": min(window, len(chunk)),
            }
        )
    return points


def consistency(trades: Sequence[JournalTrade], timezone: str) -> dict:
    days = calendar_days(trades, timezone)
    r_days = [Decimal(str(d["r"])) for d in days if d["r"] is not None]
    profitable_days = sum(1 for d in days if d["r"] is not None and Decimal(str(d["r"])) > 0)
    from app.engines.performance_engine import _stdev_sample

    week_buckets: dict[str, Decimal] = defaultdict(lambda: ZERO)
    tz = ZoneInfo(timezone)
    for t in closed_only(trades):
        local = as_utc(t.entry_at).astimezone(tz)
        iso = local.isocalendar()
        key = f"{iso.year}-W{iso.week:02d}"
        r = r_of(t)
        if r is not None:
            week_buckets[key] += r
    return {
        "trading_days": len(days),
        "profitable_days": profitable_days,
        "profitable_day_pct": ratio(Decimal(profitable_days) / Decimal(len(days)) * Decimal("100")) if days else None,
        "average_daily_r": ratio(sum(r_days, ZERO) / Decimal(len(r_days))) if r_days else None,
        "median_daily_r": ratio(Decimal(str(median([float(x) for x in r_days])))) if r_days else None,
        "stdev_daily_r": ratio(_stdev_sample(r_days)) if len(r_days) >= 2 else None,
        "best_day": max(days, key=lambda d: Decimal(str(d["r"] or 0))) if days else None,
        "worst_day": min(days, key=lambda d: Decimal(str(d["r"] or 0))) if days else None,
        "profitable_weeks": sum(1 for v in week_buckets.values() if v > 0),
        "losing_weeks": sum(1 for v in week_buckets.values() if v < 0),
        "weeks": len(week_buckets),
        "evidence": evidence_payload(len(days)),
    }


def drawdown_episodes(curve: Sequence[EquityPoint]) -> dict:
    episodes = []
    start_i = None
    peak = None
    trough = None
    for i, p in enumerate(curve):
        in_dd = p.drawdown > ZERO
        if in_dd and start_i is None:
            start_i = i
            peak = p.peak
            trough = p.equity
        elif in_dd:
            if trough is None or p.equity < trough:
                trough = p.equity
        elif start_i is not None:
            start = curve[start_i]
            duration = max(0, (p.at - start.at).days)
            depth = money((peak or start.peak) - (trough or start.equity))
            episodes.append(
                {
                    "start": start.at.isoformat(),
                    "end": p.at.isoformat(),
                    "duration_days": duration,
                    "depth": depth,
                    "recovered": True,
                }
            )
            start_i = None
            peak = None
            trough = None
    if start_i is not None and curve:
        start = curve[start_i]
        last = curve[-1]
        episodes.append(
            {
                "start": start.at.isoformat(),
                "end": None,
                "duration_days": max(0, (last.at - start.at).days),
                "depth": money((peak or start.peak) - (trough or last.equity)),
                "recovered": False,
            }
        )
    open_ep = next((e for e in reversed(episodes) if not e["recovered"]), None)
    worst = max(episodes, key=lambda e: Decimal(str(e["depth"]))) if episodes else None
    return {
        "episodes": episodes[-24:],
        "open": open_ep,
        "worst": worst,
        "n_episodes": len(episodes),
    }


def after_consecutive_losses(trades: Sequence[JournalTrade], starting: Decimal, n: int = 2) -> dict:
    ordered = _ordered(trades)
    selected: list[JournalTrade] = []
    run = 0
    for i, t in enumerate(ordered):
        if i > 0 and run >= n:
            selected.append(t)
        if t.result == TradeResult.LOSS:
            run += 1
        else:
            run = 0
    row = dump_perf_group(f"after_{n}_losses", selected, starting, "After consecutive losses")
    row["threshold"] = n
    return row


def key_observations(
    *,
    sessions: list[dict],
    setups: list[dict],
    psychology: list[dict],
    frequency: list[dict],
    after_losses: dict,
    avg_risk_escalation_pct: Decimal | None,
    n_trades: int,
) -> list[dict]:
    notes: list[dict] = []

    def eligible(rows: list[dict]) -> list[dict]:
        return [r for r in rows if int(r.get("n") or 0) >= MIN_INSIGHT_N and r.get("expectancy_r") is not None]

    sess = eligible(sessions)
    if len(sess) >= 2:
        best = max(sess, key=lambda r: Decimal(str(r["expectancy_r"])))
        worst = min(sess, key=lambda r: Decimal(str(r["expectancy_r"])))
        delta = Decimal(str(best["expectancy_r"])) - Decimal(str(worst["expectancy_r"]))
        notes.append(
            {
                "title": "Session comparison",
                "text": (
                    f"{best['key']} expectancy is {ratio(delta)}R "
                    f"{'higher' if delta >= 0 else 'lower'} than {worst['key']} "
                    f"({best['key']} n={best['n']}, {worst['key']} n={worst['n']}). Descriptive only."
                ),
                "metric": "expectancy_r",
                "sample_size": int(best["n"]) + int(worst["n"]),
                "evidence": evidence_payload(int(best["n"]) + int(worst["n"])),
            }
        )
    setups_e = eligible(setups)
    if setups_e:
        best = max(setups_e, key=lambda r: (Decimal(str(r["expectancy_r"])), r["n"]))
        notes.append(
            {
                "title": "Setup with highest expectancy",
                "text": (
                    f"{best['key']} has the highest expectancy among setups with at least "
                    f"{MIN_INSIGHT_N} observations: {best['expectancy_r']}R (n={best['n']})."
                ),
                "metric": "expectancy_r",
                "sample_size": int(best["n"]),
                "evidence": best["evidence"],
            }
        )
    for row in eligible(psychology):
        if row["key"] in {"fomo", "revenge", "frustrated", "anxious"} and Decimal(str(row["expectancy_r"])) < 0:
            notes.append(
                {
                    "title": f"Observed {row['key']} relationship",
                    "text": (
                        f"Trades tagged {row['key']} are associated with {row['expectancy_r']}R expectancy "
                        f"across {row['n']} observations. Historical relationship, not a cause."
                    ),
                    "metric": "expectancy_r",
                    "sample_size": int(row["n"]),
                    "evidence": row["evidence"],
                }
            )
    freq_e = eligible(frequency)
    one = next((r for r in freq_e if r["key"] == "1"), None)
    heavy = next((r for r in frequency if r["key"] in {"3", "4+"} and int(r.get("n") or 0) >= MIN_INSIGHT_N), None)
    if one and heavy and one.get("expectancy_r") is not None and heavy.get("expectancy_r") is not None:
        notes.append(
            {
                "title": "Trades per day",
                "text": (
                    f"Expectancy on 1-trade days is {one['expectancy_r']}R (n={one['n']}); "
                    f"on {heavy['key']} trades/day it is {heavy['expectancy_r']}R (n={heavy['n']}). "
                    "Investigate whether frequency coincides with process breakdown — not a rule."
                ),
                "metric": "expectancy_r",
                "sample_size": int(one["n"]) + int(heavy["n"]),
                "evidence": evidence_payload(int(one["n"]) + int(heavy["n"])),
            }
        )
    if after_losses.get("n") and int(after_losses["n"]) >= MIN_INSIGHT_N and after_losses.get("expectancy_r") is not None:
        notes.append(
            {
                "title": "After consecutive losses",
                "text": (
                    f"Historical expectancy after {after_losses.get('threshold', 2)} consecutive losses is "
                    f"{after_losses['expectancy_r']}R across {after_losses['n']} observations."
                ),
                "metric": "expectancy_r",
                "sample_size": int(after_losses["n"]),
                "evidence": after_losses.get("evidence") or evidence_payload(int(after_losses["n"])),
            }
        )
    if avg_risk_escalation_pct is not None:
        notes.append(
            {
                "title": "Risk unit vs recent average",
                "text": (
                    f"Average risk over the last lookback window differs from the configured unit by "
                    f"{avg_risk_escalation_pct}%."
                ),
                "metric": "risk_escalation_pct",
                "sample_size": n_trades,
                "evidence": evidence_payload(n_trades),
            }
        )
    if not notes:
        notes.append(
            {
                "title": "Insufficient comparisons",
                "text": (
                    f"Only {n_trades} closed trade(s) in this filter. "
                    f"Comparisons require at least {MIN_INSIGHT_N} observations in a bucket."
                ),
                "metric": "n",
                "sample_size": n_trades,
                "evidence": evidence_payload(n_trades),
            }
        )
    return notes[:8]
