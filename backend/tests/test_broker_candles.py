"""Broker candle coverage: a partial MT5 window is not padded with another feed."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.market_data.broker_candles import _covers
from app.market_data.schemas import Candle


def _bar(ts: datetime) -> Candle:
    return Candle(
        symbol="EURUSD",
        provider="mt5",
        timeframe="M1",
        timestamp=ts,
        open=Decimal("1.1"),
        high=Decimal("1.2"),
        low=Decimal("1.0"),
        close=Decimal("1.1"),
    )


def test_broker_window_must_cover_the_requested_range() -> None:
    start = datetime(2026, 8, 24, 10, 0, tzinfo=timezone.utc)
    candles = [_bar(start), _bar(start + timedelta(minutes=1))]
    assert _covers(candles, start, start + timedelta(seconds=30), "M1") is True
    assert _covers(candles, start, start + timedelta(hours=2), "M1") is False
    assert _covers([], start, start + timedelta(minutes=1), "M1") is False
