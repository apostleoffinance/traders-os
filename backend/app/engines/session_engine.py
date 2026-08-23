"""Timezone-aware FX session classification.

Sessions are defined in their native market timezones. DST for London and
New York is handled by the IANA tz database via zoneinfo — never by hardcoded
offsets or Nigerian wall-clock times.

Preferred personal windows (e.g. 08:00–11:00 Africa/Lagos) are a separate
concept used for discipline / risk warnings, not for session labels.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.core.enums import SessionName
from app.core.time import as_utc


@dataclass(frozen=True)
class SessionWindow:
    name: str
    timezone: str
    start: time
    end: time  # exclusive


# Canonical FX cash-session windows in local exchange time.
DEFAULT_SESSIONS: tuple[SessionWindow, ...] = (
    SessionWindow("asia", "Asia/Tokyo", time(9, 0), time(18, 0)),
    SessionWindow("london", "Europe/London", time(8, 0), time(16, 30)),
    SessionWindow("new_york", "America/New_York", time(8, 0), time(17, 0)),
)


@dataclass(frozen=True)
class PreferredWindow:
    name: str
    timezone: str
    start: time
    end: time


# Initial user preference — stored on the risk profile in production.
DEFAULT_PREFERRED_WINDOWS: tuple[PreferredWindow, ...] = (
    PreferredWindow("london_morning", "Africa/Lagos", time(8, 0), time(11, 0)),
    PreferredWindow("london_ny_overlap", "Africa/Lagos", time(13, 0), time(16, 0)),
)


def _in_window(local_t: time, start: time, end: time) -> bool:
    if start <= end:
        return start <= local_t < end
    # overnight window
    return local_t >= start or local_t < end


def active_canonical_sessions(
    ts: datetime,
    windows: tuple[SessionWindow, ...] = DEFAULT_SESSIONS,
) -> set[str]:
    utc = as_utc(ts)
    active: set[str] = set()
    for window in windows:
        local = utc.astimezone(ZoneInfo(window.timezone)).timetz().replace(tzinfo=None)
        if _in_window(local, window.start, window.end):
            active.add(window.name)
    return active


def classify_session(
    ts: datetime,
    windows: tuple[SessionWindow, ...] = DEFAULT_SESSIONS,
) -> SessionName:
    active = active_canonical_sessions(ts, windows)
    in_london = "london" in active
    in_ny = "new_york" in active
    in_asia = "asia" in active
    if in_london and in_ny:
        return SessionName.LONDON_NY_OVERLAP
    if in_london:
        return SessionName.LONDON
    if in_ny:
        return SessionName.NEW_YORK
    if in_asia:
        return SessionName.ASIA
    return SessionName.OUTSIDE


def in_preferred_window(
    ts: datetime,
    windows: tuple[PreferredWindow, ...] | list[PreferredWindow] = DEFAULT_PREFERRED_WINDOWS,
) -> bool:
    utc = as_utc(ts)
    for window in windows:
        local = utc.astimezone(ZoneInfo(window.timezone)).timetz().replace(tzinfo=None)
        if _in_window(local, window.start, window.end):
            return True
    return False


def local_display(ts: datetime, timezone: str = "Africa/Lagos") -> datetime:
    return as_utc(ts).astimezone(ZoneInfo(timezone))
