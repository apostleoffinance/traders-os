"""Resolve analysis windows. Calendar uses the trader timezone. Engines slice; the LLM does not."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.exceptions import DomainError
from app.core.time import as_utc

CALENDAR_PRESETS = {
    "today",
    "this_week",
    "last_7_days",
    "this_month",
    "last_30_days",
    "custom",
}

LAST_N_PRESETS = {
    "last_20": 20,
    "last_50": 50,
    "last_100": 100,
}

PRESETS = CALENDAR_PRESETS | set(LAST_N_PRESETS)

LABELS = {
    "today": "Today",
    "this_week": "This week",
    "last_7_days": "Last 7 days",
    "this_month": "This month",
    "last_30_days": "Last 30 days",
    "last_20": "Last 20 trades",
    "last_50": "Last 50 trades",
    "last_100": "Last 100 trades",
    "custom": "Custom range",
}


@dataclass(frozen=True)
class PeriodSpec:
    preset: str
    kind: str  # calendar | last_n
    label: str
    last_n: int | None
    start: datetime | None  # inclusive, timezone-aware local
    end: datetime | None  # exclusive, timezone-aware local
    prev_start: datetime | None
    prev_end: datetime | None


def _local_now(timezone: str) -> datetime:
    return datetime.now(ZoneInfo(timezone))


def _start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _parse_date(value: str | None, *, field: str) -> date:
    if not value:
        raise DomainError(f"{field} is required for a custom range.", code="invalid_period")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise DomainError(f"{field} must be YYYY-MM-DD.", code="invalid_period") from exc


def resolve_period(
    preset: str,
    *,
    timezone: str,
    start: str | None = None,
    end: str | None = None,
    now: datetime | None = None,
) -> PeriodSpec:
    key = (preset or "").strip().lower()
    if key not in PRESETS:
        raise DomainError(
            f"Unknown period '{preset}'. Use one of: {', '.join(sorted(PRESETS))}.",
            code="invalid_period",
        )
    tz = ZoneInfo(timezone)
    now_local = (now or _local_now(timezone)).astimezone(tz)
    today = _start_of_day(now_local)

    if key in LAST_N_PRESETS:
        n = LAST_N_PRESETS[key]
        return PeriodSpec(
            preset=key,
            kind="last_n",
            label=LABELS[key],
            last_n=n,
            start=None,
            end=None,
            prev_start=None,
            prev_end=None,
        )

    if key == "today":
        start_dt = today
        end_dt = now_local
        prev_start = today - timedelta(days=1)
        prev_end = today
    elif key == "this_week":
        start_dt = today - timedelta(days=today.weekday())
        end_dt = now_local
        prev_end = start_dt
        prev_start = start_dt - timedelta(days=7)
    elif key == "last_7_days":
        start_dt = now_local - timedelta(days=7)
        end_dt = now_local
        prev_end = start_dt
        prev_start = start_dt - timedelta(days=7)
    elif key == "this_month":
        start_dt = today.replace(day=1)
        end_dt = now_local
        if start_dt.month == 1:
            prev_start = start_dt.replace(year=start_dt.year - 1, month=12)
        else:
            prev_start = start_dt.replace(month=start_dt.month - 1)
        prev_end = start_dt
    elif key == "last_30_days":
        start_dt = now_local - timedelta(days=30)
        end_dt = now_local
        prev_end = start_dt
        prev_start = start_dt - timedelta(days=30)
    else:
        tz_today = today.date()
        start_d = _parse_date(start, field="start")
        end_d = _parse_date(end, field="end")
        if end_d < start_d:
            raise DomainError("Custom range end must be on or after start.", code="invalid_period")
        if (end_d - start_d).days > 731:
            raise DomainError("Custom range cannot exceed two years.", code="invalid_period")
        if start_d > tz_today:
            raise DomainError("Custom range cannot start in the future.", code="invalid_period")
        start_dt = datetime(start_d.year, start_d.month, start_d.day, tzinfo=tz)
        end_exclusive = datetime(end_d.year, end_d.month, end_d.day, tzinfo=tz) + timedelta(days=1)
        end_dt = min(end_exclusive, now_local + timedelta(seconds=1))
        span = end_dt - start_dt
        prev_end = start_dt
        prev_start = start_dt - span
        return PeriodSpec(
            preset="custom",
            kind="calendar",
            label=f"{start_d.isoformat()} → {end_d.isoformat()}",
            last_n=None,
            start=start_dt,
            end=end_dt,
            prev_start=prev_start,
            prev_end=prev_end,
        )

    return PeriodSpec(
        preset=key,
        kind="calendar",
        label=LABELS[key],
        last_n=None,
        start=start_dt,
        end=end_dt,
        prev_start=prev_start,
        prev_end=prev_end,
    )


def slice_trades(trades: list, spec: PeriodSpec, timestamp_attr: str = "trade_timestamp") -> tuple[list, list]:
    """Return (selected, previous). last_n uses order as given (oldest → newest)."""
    if spec.kind == "last_n":
        n = spec.last_n or 0
        selected = list(trades[-n:]) if n else []
        prev = list(trades[-(2 * n) : -n]) if n else []
        return selected, prev

    def local_ts(trade) -> datetime:
        raw = getattr(trade, timestamp_attr)
        return as_utc(raw).astimezone(spec.start.tzinfo)  # type: ignore[union-attr]

    selected = [t for t in trades if spec.start <= local_ts(t) < spec.end]  # type: ignore[operator]
    previous = [
        t
        for t in trades
        if spec.prev_start is not None
        and spec.prev_end is not None
        and spec.prev_start <= local_ts(t) < spec.prev_end
    ]
    return selected, previous
