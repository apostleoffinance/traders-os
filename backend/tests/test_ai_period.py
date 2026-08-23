from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

from app.ai.period import resolve_period, slice_trades
from app.core.exceptions import DomainError


def test_this_week_starts_monday_lagos() -> None:
    # Wednesday 12 Aug 2026 15:00 Lagos
    now = datetime(2026, 8, 12, 15, 0, tzinfo=ZoneInfo("Africa/Lagos"))
    spec = resolve_period("this_week", timezone="Africa/Lagos", now=now)
    assert spec.start.weekday() == 0
    assert spec.start.day == 10
    assert spec.end.day == 12
    assert spec.prev_end == spec.start
    assert (spec.start - spec.prev_start).days == 7


def test_today_is_local_calendar_day() -> None:
    now = datetime(2026, 8, 12, 2, 0, tzinfo=ZoneInfo("UTC"))
    spec = resolve_period("today", timezone="Africa/Lagos", now=now)
    # 02:00 UTC is 03:00 Lagos on the 12th
    assert spec.start.day == 12
    assert spec.start.tzinfo.key == "Africa/Lagos"


def test_last_n_has_no_overlap() -> None:
    trades = [SimpleNamespace(id=i, trade_timestamp=datetime(2026, 1, i, tzinfo=ZoneInfo("UTC"))) for i in range(1, 31)]
    spec = resolve_period("last_20", timezone="UTC")
    selected, previous = slice_trades(trades, spec)
    assert [t.id for t in selected] == list(range(11, 31))
    assert [t.id for t in previous] == list(range(1, 11))
    assert {t.id for t in selected}.isdisjoint({t.id for t in previous})


def test_calendar_slice_excludes_outside() -> None:
    tz = ZoneInfo("UTC")
    trades = [
        SimpleNamespace(id=1, trade_timestamp=datetime(2026, 8, 1, 10, tzinfo=tz)),
        SimpleNamespace(id=2, trade_timestamp=datetime(2026, 8, 10, 10, tzinfo=tz)),
        SimpleNamespace(id=3, trade_timestamp=datetime(2026, 8, 20, 10, tzinfo=tz)),
    ]
    spec = resolve_period("custom", timezone="UTC", start="2026-08-08", end="2026-08-12", now=datetime(2026, 8, 21, tzinfo=tz))
    selected, _ = slice_trades(trades, spec)
    assert [t.id for t in selected] == [2]


def test_custom_rejects_inverted_range() -> None:
    with pytest.raises(DomainError) as exc:
        resolve_period("custom", timezone="UTC", start="2026-08-20", end="2026-08-01")
    assert exc.value.code == "invalid_period"


def test_unknown_preset() -> None:
    with pytest.raises(DomainError):
        resolve_period("quarter", timezone="UTC")
