"""FX quote conversion and candle normalization (no product HTTP surface)."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.engines.fx_math import get_instrument
from app.market_data.conversion import conversion_for_account
from app.market_data.normalization import candle, parse_utc_ms, validate_ohlc


def test_ohlc_validation_rejects_inverted_bar() -> None:
    with pytest.raises(ValueError):
        validate_ohlc(Decimal("1.2"), Decimal("1.1"), Decimal("1.0"), Decimal("1.15"))


def test_dukascopy_row_normalizes_to_internal_schema() -> None:
    row = [1755767700000, 1.17420, 1.17480, 1.17390, 1.17460, None]
    c = candle(
        symbol="EURUSD",
        provider="dukascopy",
        timeframe="M5",
        timestamp=parse_utc_ms(row[0]),
        open_=row[1],
        high=row[2],
        low=row[3],
        close=row[4],
        volume=row[5],
    )
    assert c.symbol == "EURUSD"
    assert c.provider == "dukascopy"
    assert c.timeframe == "M5"
    assert c.timestamp.tzinfo is not None
    assert c.volume is None
    assert c.close == Decimal("1.17460")


def test_ccxt_row_normalizes() -> None:
    c = candle(
        symbol="BTCUSDT",
        provider="binance",
        timeframe="M5",
        timestamp=parse_utc_ms(1755767700000),
        open_=67200,
        high=67350,
        low=67180,
        close=67320,
        volume=123.45,
    )
    assert c.symbol == "BTCUSDT"
    assert c.volume == Decimal("123.45")


def test_oanda_mid_normalizes() -> None:
    c = candle(
        symbol="EURUSD",
        provider="oanda",
        timeframe="M15",
        timestamp=datetime(2026, 8, 21, 10, 0, tzinfo=timezone.utc),
        open_="1.17420",
        high="1.17480",
        low="1.17390",
        close="1.17460",
        volume=12,
    )
    assert c.provider == "oanda"
    assert c.open == Decimal("1.17420")


def test_eurusd_conversion_is_one() -> None:
    spec = get_instrument("EURUSD")
    r = conversion_for_account(spec, "USD")
    assert r.rate == Decimal("1")
    assert r.assumed is False


def test_usdjpy_conversion_inverts_quote() -> None:
    spec = get_instrument("USDJPY")
    r = conversion_for_account(spec, "USD", quote_price=Decimal("150"))
    assert r.rate == Decimal("1") / Decimal("150")
    assert r.reason is None


def test_missing_conversion_does_not_fabricate() -> None:
    spec = get_instrument("USDCAD")
    r = conversion_for_account(spec, "USD")
    assert r.rate is None
    assert "cannot be verified" in (r.reason or "").lower()
