"""Trade-linked market snapshots are immutable and deduplicated by candle fingerprint."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_db
from app.db.base import Base
from app.main import app
from app import models  # noqa: F401
from app.market_data.schemas import Candle


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def override():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _headers(token: str) -> dict:
    return {"Authorization": "Bearer " + token}


def _candles(start: datetime, revision: int = 0) -> list[Candle]:
    close = Decimal("1.1005") + Decimal(revision) * Decimal("0.0001")
    return [
        Candle(
            symbol="EURUSD", provider="dukascopy", timeframe="M1",
            timestamp=start, open=Decimal("1.1000"), high=Decimal("1.1010"),
            low=Decimal("1.0990"), close=close, volume=None,
        ),
        Candle(
            symbol="EURUSD", provider="dukascopy", timeframe="M1",
            timestamp=start + timedelta(minutes=1), open=close, high=close + Decimal("0.0005"),
            low=close - Decimal("0.0005"), close=close, volume=None,
        ),
        Candle(
            symbol="EURUSD", provider="dukascopy", timeframe="M1",
            timestamp=start + timedelta(minutes=3), open=close, high=close + Decimal("0.0008"),
            low=close - Decimal("0.0004"), close=close + Decimal("0.0002"), volume=None,
        ),
    ]


def test_trade_replay_persists_and_versions_market_snapshots(client: TestClient, monkeypatch) -> None:
    auth = client.post(
        "/api/auth/register",
        json={"email": "market-snapshot@example.com", "password": "password12", "display_name": "snapshot"},
    )
    assert auth.status_code == 201, auth.text
    headers = _headers(auth.json()["access_token"])
    account_response = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "Personal",
            "program": "Manual",
            "account_name": "Replay account",
            "starting_balance": "1000.00",
        },
    )
    assert account_response.status_code == 201, account_response.text
    account_id = account_response.json()["id"]

    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=2)
    monkeypatch.setattr(
        "app.market_data.service.get_ohlcv_range",
        lambda _db, _symbol, _timeframe, **_kwargs: _candles(start),
    )
    created = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": start.isoformat(),
            "exit_timestamp": end.isoformat(),
            "timezone": "UTC",
            "timeframe": "M15",
            "entry_price": "1.1000",
            "exit_price": "1.1090",
            "stop_loss": "1.0950",
            "take_profit": "1.1100",
            "lot_size": "0.01",
            "quote_to_account_rate": "1",
            "acknowledged_warnings": True,
            "setup_valid": True,
            "rules_followed": True,
        },
    )
    assert created.status_code == 201, created.text
    trade_id = created.json()["id"]

    first = client.get("/api/trades/" + trade_id + "/replay", headers=headers)
    assert first.status_code == 200, first.text
    first_snapshot = first.json()["market_snapshot"]
    assert first_snapshot["status"] == "available"
    assert first_snapshot["version"] == 1
    assert first_snapshot["candle_count"] == 3
    assert first_snapshot["gap_count"] == 1
    assert first_snapshot["immutable_snapshot"] is True

    repeated = client.get("/api/trades/" + trade_id + "/replay", headers=headers)
    assert repeated.status_code == 200, repeated.text
    repeated_snapshot = repeated.json()["market_snapshot"]
    assert repeated_snapshot["id"] == first_snapshot["id"]
    assert repeated_snapshot["version"] == 1

    monkeypatch.setattr(
        "app.market_data.service.get_ohlcv_range",
        lambda _db, _symbol, _timeframe, **_kwargs: _candles(start, revision=1),
    )
    revised = client.get("/api/trades/" + trade_id + "/replay", headers=headers)
    assert revised.status_code == 200, revised.text
    revised_snapshot = revised.json()["market_snapshot"]
    assert revised_snapshot["id"] != first_snapshot["id"]
    assert revised_snapshot["version"] == 2
