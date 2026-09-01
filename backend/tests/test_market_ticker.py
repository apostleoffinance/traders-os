"""Market Pulse ticker normalization and change logic."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.market_data.ticker import (
    TICKER_SYMBOLS,
    ChangeBasis,
    _compute_change,
    _direction,
    _filter_payload,
    _quote_row,
    clear_ticker_cache,
    get_ticker,
)


def test_ticker_symbols_cover_catalog() -> None:
    assert "EURUSD" in TICKER_SYMBOLS
    assert "BTCUSDT" in TICKER_SYMBOLS
    assert len(TICKER_SYMBOLS) >= 10


def test_direction_positive_negative_flat() -> None:
    assert _direction(Decimal("0.01")) == "up"
    assert _direction(Decimal("-0.01")) == "down"
    assert _direction(Decimal("0")) == "flat"
    assert _direction(None) == "flat"


def test_compute_change_positive_negative_zero() -> None:
    basis = ChangeBasis(reference=Decimal("1.0"), label="previous_daily_close")
    change, pct, label = _compute_change(Decimal("1.01"), basis)
    assert change == Decimal("0.01")
    assert pct == Decimal("1.00")
    assert label == "previous_daily_close"

    change, pct, _ = _compute_change(Decimal("0.99"), basis)
    assert change == Decimal("-0.01")
    assert pct == Decimal("-1.00")

    change, pct, _ = _compute_change(Decimal("1.0"), basis)
    assert change == Decimal("0")
    assert pct == Decimal("0.00")


def test_compute_change_missing_reference() -> None:
    change, pct, label = _compute_change(Decimal("1.1"), None)
    assert change is None
    assert pct is None
    assert label == "none"


def test_quote_row_unavailable_on_provider_failure() -> None:
    db = MagicMock()
    with patch("app.market_data.ticker.market_service.get_quote", side_effect=RuntimeError("down")):
        row = _quote_row(db, "EURUSD")
    assert row["status"] == "unavailable"
    assert "price" not in row


def test_quote_row_no_fake_zero_price() -> None:
    db = MagicMock()
    with patch(
        "app.market_data.ticker.market_service.get_quote",
        return_value={"last": "0", "freshness": "fresh", "provider": "dukascopy", "timestamp": "2026-01-01T00:00:00Z"},
    ):
        row = _quote_row(db, "EURUSD")
    assert row["status"] == "unavailable"


def test_quote_row_ok_with_change() -> None:
    db = MagicMock()
    with (
        patch(
            "app.market_data.ticker.market_service.get_quote",
            return_value={
                "last": "1.1000",
                "freshness": "fresh",
                "provider": "dukascopy",
                "timestamp": "2026-01-01T00:00:00Z",
                "cached": False,
                "age_seconds": 5,
            },
        ),
        patch(
            "app.market_data.ticker._change_basis",
            return_value=ChangeBasis(reference=Decimal("1.0900"), label="previous_daily_close"),
        ),
    ):
        row = _quote_row(db, "EURUSD")
    assert row["status"] == "ok"
    assert row["price"] == 1.1
    assert row["direction"] == "up"
    assert row["change_percent"] == pytest.approx(0.92, rel=1e-2)


def test_quote_row_stale_when_cached() -> None:
    db = MagicMock()
    with (
        patch(
            "app.market_data.ticker.market_service.get_quote",
            return_value={
                "last": "1.1000",
                "freshness": "recent",
                "provider": "dukascopy",
                "timestamp": "2026-01-01T00:00:00Z",
                "cached": True,
                "age_seconds": 120,
            },
        ),
        patch("app.market_data.ticker._change_basis", return_value=None),
    ):
        row = _quote_row(db, "EURUSD")
    assert row["status"] == "stale"
    assert row["is_stale"] is True


def test_filter_payload_preserves_order() -> None:
    payload = {
        "updated_at": "2026-01-01T00:00:00Z",
        "quotes": [
            {"symbol": "BTCUSDT"},
            {"symbol": "EURUSD"},
            {"symbol": "GBPUSD"},
        ],
    }
    out = _filter_payload(payload, ["GBPUSD", "EURUSD"])
    assert [q["symbol"] for q in out["quotes"]] == ["GBPUSD", "EURUSD"]


def test_get_ticker_uses_cache() -> None:
    clear_ticker_cache()
    db = MagicMock()
    with patch("app.market_data.ticker._refresh") as refresh:
        refresh.return_value = {"updated_at": "t", "quotes": [{"symbol": "EURUSD", "status": "ok"}]}
        first = get_ticker(db)
        second = get_ticker(db)
    assert refresh.call_count == 1
    assert first["quotes"][0]["symbol"] == "EURUSD"
    assert second["quotes"][0]["symbol"] == "EURUSD"
    clear_ticker_cache()
