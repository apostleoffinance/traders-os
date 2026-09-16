"""Timed MFE/MAE and OHLC path series for Trade Anatomy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace

from app.engines.trade_anatomy_path import (
    build_price_series,
    enrich_replay_with_candles,
    timed_excursions_from_candles,
)


def _candle(ts: datetime, o: str, h: str, l: str, c: str):
    return SimpleNamespace(
        symbol="EURUSD",
        provider="test",
        timeframe="M1",
        timestamp=ts,
        open=Decimal(o),
        high=Decimal(h),
        low=Decimal(l),
        close=Decimal(c),
        volume=None,
    )


def test_timed_excursions_long_order():
    start = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    candles = [
        _candle(start, "1.1000", "1.1005", "1.0990", "1.0995"),  # MAE first
        _candle(start + timedelta(minutes=5), "1.0995", "1.1030", "1.0994", "1.1025"),  # MFE
        _candle(start + timedelta(minutes=10), "1.1025", "1.1028", "1.1010", "1.1015"),
    ]
    timed = timed_excursions_from_candles(
        candles,
        direction="long",
        entry=Decimal("1.1000"),
    )
    assert timed is not None
    assert timed.mfe_price == Decimal("1.1030")
    assert timed.mae_price == Decimal("1.0990")
    assert timed.mae_at == start
    assert timed.mfe_at == start + timedelta(minutes=5)


def test_timed_excursions_short():
    start = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    candles = [
        _candle(start, "1.1000", "1.1010", "1.0998", "1.1005"),  # MAE (adverse high)
        _candle(start + timedelta(minutes=3), "1.1005", "1.1006", "1.0970", "1.0975"),  # MFE
    ]
    timed = timed_excursions_from_candles(
        candles,
        direction="short",
        entry=Decimal("1.1000"),
    )
    assert timed is not None
    assert timed.mfe_price == Decimal("1.0970")
    assert timed.mae_price == Decimal("1.1010")
    assert timed.mae_at == start
    assert timed.mfe_at == start + timedelta(minutes=3)


def test_price_series_progress_bounds():
    start = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=10)
    candles = [
        _candle(start, "1.1", "1.101", "1.099", "1.100"),
        _candle(start + timedelta(minutes=5), "1.100", "1.102", "1.100", "1.101"),
        _candle(end, "1.101", "1.103", "1.101", "1.102"),
    ]
    series = build_price_series(candles, start=start, end=end)
    assert series is not None
    assert series["source"] == "m1_ohlc"
    assert series["points"][0]["t"] == 0.0
    assert series["points"][-1]["t"] == 1.0
    assert len(series["points"]) >= 3


def test_enrich_replay_adds_series_and_timing():
    start = datetime(2026, 3, 10, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=10)
    candles = [
        _candle(start, "1.1000", "1.1005", "1.0990", "1.0995"),
        _candle(start + timedelta(minutes=5), "1.0995", "1.1030", "1.0994", "1.1025"),
        _candle(end, "1.1025", "1.1028", "1.1010", "1.1015"),
    ]
    payload = {
        "excursions": {
            "mfe_price": None,
            "mae_price": None,
            "mfe_r": None,
            "mae_r": None,
            "mfe_at": None,
            "mae_at": None,
            "mfe_t": None,
            "mae_t": None,
        },
        "price_series": None,
    }
    out = enrich_replay_with_candles(
        payload,
        candles,
        direction="long",
        entry=Decimal("1.1000"),
        start=start,
        end=end,
        mfe_price=None,
        mae_price=None,
    )
    assert out["price_series"]["bar_count"] == 3
    assert out["excursions"]["mfe_at"] is not None
    assert out["excursions"]["mae_at"] is not None
    assert out["excursions"]["mae_t"] == 0.0
    assert out["excursions"]["mfe_t"] == 0.5
