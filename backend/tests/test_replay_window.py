from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.market_data import replay_window
from app.market_data.replay_window import ReplayWindowIn, build_replay_window
from app.market_data.schemas import Candle


START = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
END = START + timedelta(minutes=10)


class FakeProvider:
    def __init__(self, name: str):
        self.name = name

    def get_ohlcv(self, symbol, timeframe, *, start=None, end=None, limit=500):
        price = Decimal("1.10000") if symbol == "EURUSD" else Decimal("65000")
        return [
            Candle(
                symbol=symbol, provider=self.name, timeframe=timeframe,
                timestamp=START + timedelta(minutes=offset * 5),
                open=price, high=price + Decimal("1"), low=price - Decimal("1"),
                close=price + Decimal("0.5"), volume=Decimal("10"),
            )
            for offset in range(3)
        ]


class FakeDb:
    def __init__(self):
        self.committed = False
        self.rolled_back = False

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def test_request_requires_timezone_and_fx_plus_crypto():
    with pytest.raises(ValueError, match="timezone"):
        ReplayWindowIn(start=datetime(2026, 9, 1), end=datetime(2026, 9, 2))
    with pytest.raises(ValueError, match="exactly one FX"):
        ReplayWindowIn(symbols=["EURUSD", "GBPUSD"], start=START, end=END)


def test_replay_window_fetches_persists_and_merges_same_utc_window(monkeypatch):
    db = FakeDb()
    writes = []
    monkeypatch.setattr(
        replay_window, "providers_for_symbol",
        lambda symbol: [FakeProvider("dukascopy" if symbol == "EURUSD" else "binance")],
    )
    monkeypatch.setattr(
        replay_window.cache, "persist_candles",
        lambda _db, bars: writes.extend(bars) or len(bars),
    )
    request = ReplayWindowIn(start=START, end=END, timeframe="M5", limit=10)
    result = build_replay_window(db, request)

    assert db.committed is True
    assert db.rolled_back is False
    assert len(writes) == 6
    assert result["status"] == "ok"
    assert result["window"] == {
        "start": "2026-09-01T08:00:00Z",
        "end": "2026-09-01T08:10:00Z",
        "timezone": "UTC",
    }
    assert [series["symbol"] for series in result["series"]] == ["EURUSD", "BTCUSDT"]
    assert [series["provider"] for series in result["series"]] == ["dukascopy", "binance"]
    assert result["timeline_count"] == 6
    assert result["timeline"] == sorted(
        result["timeline"], key=lambda row: (row["timestamp"], row["symbol"])
    )
    assert result["timeline"][0]["timestamp"] == "2026-09-01T08:00:00Z"


def test_replay_window_rolls_back_if_second_market_has_no_data(monkeypatch):
    db = FakeDb()

    def providers(symbol):
        class Provider(FakeProvider):
            def get_ohlcv(self, *args, **kwargs):
                if symbol == "BTCUSDT":
                    return []
                return super().get_ohlcv(*args, **kwargs)
        return [Provider("provider")]

    monkeypatch.setattr(replay_window, "providers_for_symbol", providers)
    with pytest.raises(Exception, match="No provider returned historical candles"):
        build_replay_window(db, ReplayWindowIn(start=START, end=END))
    assert db.committed is False
    assert db.rolled_back is True
