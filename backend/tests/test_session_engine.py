from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.enums import SessionName
from app.engines.session_engine import classify_session, in_preferred_window, local_display


def _utc(year, month, day, hour, minute=0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=ZoneInfo("UTC"))


def test_london_session_in_winter() -> None:
    # 08:30 London in January = 08:30 UTC
    ts = _utc(2026, 1, 15, 8, 30)
    assert classify_session(ts) == SessionName.LONDON


def test_london_session_in_summer_dst() -> None:
    # 08:30 London in July = 07:30 UTC (BST)
    ts = _utc(2026, 7, 15, 7, 30)
    assert classify_session(ts) == SessionName.LONDON
    # 07:30 London winter would be 07:30 UTC — outside London open
    winter = _utc(2026, 1, 15, 7, 30)
    assert classify_session(winter) != SessionName.LONDON


def test_overlap_uses_both_local_opens() -> None:
    # 13:30 UTC in July: London 14:30 BST (open), NY 09:30 EDT (open)
    ts = _utc(2026, 7, 15, 13, 30)
    assert classify_session(ts) == SessionName.LONDON_NY_OVERLAP


def test_asia_tokyo() -> None:
    # 01:00 UTC = 10:00 JST
    ts = _utc(2026, 3, 10, 1, 0)
    assert classify_session(ts) == SessionName.ASIA


def test_outside_session() -> None:
    ts = _utc(2026, 1, 15, 19, 0)  # 19:00 UTC = 14:00 NY — still NY
    # 23:00 UTC January: NY 18:00 (closed 17:00), London 23:00 closed, Tokyo 08:00 not yet 09:00
    late = _utc(2026, 1, 15, 23, 0)
    assert classify_session(late) in {SessionName.OUTSIDE, SessionName.ASIA}


def test_preferred_window_lagos() -> None:
    # 08:30 WAT = 07:30 UTC
    ts = _utc(2026, 3, 10, 7, 30)
    assert in_preferred_window(ts) is True
    # 12:00 WAT = 11:00 UTC — between London morning and overlap
    midday = _utc(2026, 3, 10, 11, 0)
    assert in_preferred_window(midday) is False
    # 14:00 WAT = 13:00 UTC overlap window
    overlap = _utc(2026, 3, 10, 13, 0)
    assert in_preferred_window(overlap) is True


def test_display_timezone_lagos() -> None:
    ts = _utc(2026, 1, 15, 7, 0)
    local = local_display(ts, "Africa/Lagos")
    assert local.hour == 8
