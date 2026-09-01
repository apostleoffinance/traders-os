from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.services.analytics_service import _activity_in_date_window, _apply_filters


def _trade(entry: datetime, exit_at: datetime | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        trade_timestamp=entry,
        exit_timestamp=exit_at,
        symbol="EURUSD",
        session="london",
        setup_id=None,
        direction="long",
        timeframe="M15",
        psychology=None,
        result="win",
        status="closed",
    )


def test_activity_in_window_by_close_when_entry_is_older() -> None:
    tz = ZoneInfo("UTC")
    now = datetime(2026, 9, 1, 12, 0, tzinfo=tz)
    date_from = now.replace(day=25, month=8)
    entry = datetime(2026, 8, 10, 9, 0, tzinfo=tz)
    close = datetime(2026, 8, 28, 15, 0, tzinfo=tz)
    trade = _trade(entry, close)

    out = _apply_filters(
        [trade],
        timezone="UTC",
        date_from=date_from,
        date_to=now,
        symbol=None,
        session=None,
        setup_id=None,
        direction=None,
        timeframe=None,
        psychology=None,
        result=None,
    )
    assert len(out) == 1


def test_activity_excluded_when_neither_entry_nor_close_in_window() -> None:
    tz = ZoneInfo("UTC")
    now = datetime(2026, 9, 1, 12, 0, tzinfo=tz)
    date_from = now.replace(day=25, month=8)
    entry = datetime(2026, 8, 10, 9, 0, tzinfo=tz)
    close = datetime(2026, 8, 20, 15, 0, tzinfo=tz)
    trade = _trade(entry, close)

    out = _apply_filters(
        [trade],
        timezone="UTC",
        date_from=date_from,
        date_to=now,
        symbol=None,
        session=None,
        setup_id=None,
        direction=None,
        timeframe=None,
        psychology=None,
        result=None,
    )
    assert len(out) == 0


def test_activity_in_window_by_entry_only() -> None:
    tz = ZoneInfo("UTC")
    now = datetime(2026, 9, 1, 12, 0, tzinfo=tz)
    date_from = now.replace(day=25, month=8)
    entry = datetime(2026, 8, 29, 9, 0, tzinfo=tz)
    trade = _trade(entry, None)

    assert _activity_in_date_window(entry, None, date_from=date_from, date_to=now) is True
