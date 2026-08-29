"""Report period resolution — monthly, quarterly, yearly."""

from __future__ import annotations

from calendar import monthrange
from datetime import datetime
from zoneinfo import ZoneInfo


class PeriodResolutionError(ValueError):
    pass


def _tz(timezone: str) -> ZoneInfo:
    return ZoneInfo(timezone)


def _month_bounds(year: int, month: int, timezone: str) -> tuple[datetime, datetime]:
    if not 1 <= month <= 12:
        raise PeriodResolutionError("month must be 1–12")
    z = _tz(timezone)
    start = datetime(year, month, 1, 0, 0, 0, tzinfo=z)
    last_day = monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59, tzinfo=z)
    return start, end


def _quarter_bounds(year: int, quarter: int, timezone: str) -> tuple[datetime, datetime]:
    if quarter not in (1, 2, 3, 4):
        raise PeriodResolutionError("quarter must be 1–4")
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    z = _tz(timezone)
    start = datetime(year, start_month, 1, 0, 0, 0, tzinfo=z)
    last_day = monthrange(year, end_month)[1]
    end = datetime(year, end_month, last_day, 23, 59, 59, tzinfo=z)
    return start, end


def _year_bounds(year: int, timezone: str) -> tuple[datetime, datetime]:
    z = _tz(timezone)
    start = datetime(year, 1, 1, 0, 0, 0, tzinfo=z)
    end = datetime(year, 12, 31, 23, 59, 59, tzinfo=z)
    return start, end


def resolve_report_period(
    report_type: str,
    *,
    year: int,
    month: int | None = None,
    quarter: int | None = None,
    timezone: str,
) -> dict:
    """Return current period bounds, label, and previous period bounds."""
    kind = report_type.lower()
    if kind == "monthly":
        if month is None:
            raise PeriodResolutionError("month is required for monthly reports")
        start, end = _month_bounds(year, month, timezone)
        label = start.strftime("%B %Y")
        period_key = f"{year:04d}-{month:02d}"
        if month == 1:
            prev_start, prev_end = _month_bounds(year - 1, 12, timezone)
        else:
            prev_start, prev_end = _month_bounds(year, month - 1, timezone)
        prev_label = prev_start.strftime("%B %Y")
    elif kind == "quarterly":
        if quarter is None:
            raise PeriodResolutionError("quarter is required for quarterly reports")
        start, end = _quarter_bounds(year, quarter, timezone)
        label = f"Q{quarter} {year}"
        period_key = f"{year:04d}-Q{quarter}"
        if quarter == 1:
            prev_start, prev_end = _quarter_bounds(year - 1, 4, timezone)
        else:
            prev_start, prev_end = _quarter_bounds(year, quarter - 1, timezone)
        prev_label = f"Q{quarter - 1} {year}" if quarter > 1 else f"Q4 {year - 1}"
    elif kind == "yearly":
        start, end = _year_bounds(year, timezone)
        label = str(year)
        period_key = f"{year:04d}"
        prev_start, prev_end = _year_bounds(year - 1, timezone)
        prev_label = str(year - 1)
    else:
        raise PeriodResolutionError(f"unsupported report type: {report_type}")

    return {
        "type": kind,
        "label": label,
        "period_key": period_key,
        "start": start,
        "end": end,
        "previous": {
            "label": prev_label,
            "start": prev_start,
            "end": prev_end,
        },
    }
