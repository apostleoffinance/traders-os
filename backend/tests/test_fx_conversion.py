"""FX conversion provenance, cache, and stale policy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.engines.fx_math import get_instrument
from app.market_data import fx_rates
from app.market_data.conversion import conversion_for_account, needs_quote_price
from app.market_data.service import conversion_rate


@pytest.fixture(autouse=True)
def _clear_fx_cache():
    fx_rates.clear_quote_cache()
    yield
    fx_rates.clear_quote_cache()


def test_classify_age_bands(monkeypatch):
    monkeypatch.setattr("app.market_data.fx_rates.settings.fx_rate_fresh_seconds", 60)
    monkeypatch.setattr("app.market_data.fx_rates.settings.fx_rate_recent_seconds", 300)
    assert fx_rates.classify_age(10) == "fresh"
    assert fx_rates.classify_age(120) == "recent"
    assert fx_rates.classify_age(400) == "stale"
    assert fx_rates.classify_age(None) == "none"


def test_eurusd_conversion_provenance_no_quote_needed():
    db = MagicMock()
    out = conversion_rate(db, "EURUSD", "USD")
    assert out["rate"] == "1"
    assert out["assumed"] is False
    assert out["source"] in {"instrument", "parity"}
    assert out["freshness"] == "fresh"
    assert out["base"] == "USD"
    assert out["quote"] == "USD"
    assert needs_quote_price(get_instrument("EURUSD"), "USD") is False


def test_usdjpy_uses_quote_and_provenance():
    db = MagicMock()
    ts = datetime.now(timezone.utc)

    def fake_quote(db, symbol, *, allow_stale=True):
        return {
            "symbol": "USDJPY",
            "provider": "dukascopy",
            "timestamp": ts.isoformat().replace("+00:00", "Z"),
            "last": "150.00",
            "bid": None,
            "ask": None,
            "freshness": "fresh",
            "cached": False,
            "age_seconds": 5,
        }

    with patch("app.market_data.service.get_quote", side_effect=fake_quote):
        out = conversion_rate(db, "USDJPY", "USD", allow_stale=False)
    assert out["rate"] == str(Decimal("1") / Decimal("150"))
    assert out["source"] == "dukascopy"
    assert out["freshness"] == "fresh"
    assert out["cached"] is False
    assert out["market"]["provider"] == "dukascopy"
    assert out["stale_blocked"] is False


def test_stale_conversion_blocked_without_opt_in():
    db = MagicMock()
    old = datetime.now(timezone.utc) - timedelta(minutes=20)

    def fake_quote(db, symbol, *, allow_stale=True):
        return {
            "symbol": "USDJPY",
            "provider": "dukascopy",
            "timestamp": old.isoformat().replace("+00:00", "Z"),
            "last": "150.00",
            "freshness": "stale",
            "cached": True,
            "age_seconds": 1200,
        }

    with patch("app.market_data.service.get_quote", side_effect=fake_quote):
        out = conversion_rate(db, "USDJPY", "USD", allow_stale=False)
    assert out["rate"] is None
    assert out["stale_blocked"] is True
    assert "stale" in (out["reason"] or "").lower()


def test_stale_conversion_allowed_with_opt_in():
    db = MagicMock()
    old = datetime.now(timezone.utc) - timedelta(minutes=20)

    def fake_quote(db, symbol, *, allow_stale=True):
        return {
            "symbol": "USDJPY",
            "provider": "dukascopy",
            "timestamp": old.isoformat().replace("+00:00", "Z"),
            "last": "150.00",
            "freshness": "stale",
            "cached": True,
            "age_seconds": 1200,
        }

    with patch("app.market_data.service.get_quote", side_effect=fake_quote):
        out = conversion_rate(db, "USDJPY", "USD", allow_stale=True)
    assert out["rate"] == str(Decimal("1") / Decimal("150"))
    assert out["freshness"] == "stale"
    assert out["cached"] is True


def test_provider_failure_does_not_fabricate():
    db = MagicMock()
    with patch("app.market_data.service.get_quote", side_effect=RuntimeError("down")):
        out = conversion_rate(db, "USDCAD", "USD", allow_stale=False)
    assert out["rate"] is None
    assert "unavailable" in (out["reason"] or "").lower()


def test_usdt_parity_flagged_assumed():
    spec = get_instrument("BTCUSDT")
    r = conversion_for_account(spec, "USD")
    assert r.rate == Decimal("1")
    assert r.assumed is True
