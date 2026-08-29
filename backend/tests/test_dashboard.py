"""Dashboard health gate, equity sparkline series, and safety-limit pairs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_db
from app.db.base import Base
from app.engines.health_engine import MIN_TRADES_FOR_HEALTH, STATUS_INSUFFICIENT, STATUS_SCORED
from app.main import app
from app import models  # noqa: F401


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def _override():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _register(client: TestClient, email: str) -> dict:
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password12", "display_name": email.split("@")[0]},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _account(client: TestClient, headers: dict) -> str:
    acc = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "Dash",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acc.status_code == 201, acc.text
    return acc.json()["id"]


def _closed_trade(client: TestClient, headers: dict, account_id: str, day: int, win: bool = True) -> None:
    ts = datetime(2026, 3, 2, 8, 30, tzinfo=timezone.utc) + timedelta(days=day)
    exit_ts = ts + timedelta(hours=1)
    entry, sl, tp = "1.08500", "1.08400", "1.08700"
    exit_px = tp if win else sl
    r = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": ts.isoformat(),
            "exit_timestamp": exit_ts.isoformat(),
            "timezone": "Africa/Lagos",
            "timeframe": "M15",
            "entry_price": entry,
            "stop_loss": sl,
            "take_profit": tp,
            "exit_price": exit_px,
            "lot_size": "0.05",
            "acknowledged_warnings": True,
        },
    )
    assert r.status_code == 201, r.text


def test_empty_dashboard_health_and_safety_shape(client: TestClient) -> None:
    user = _register(client, "empty-dash@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    dash = client.get(f"/api/dashboard?account_id={account_id}", headers=headers)
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert body["n_trades"] == 0
    assert body["trading_health"] is None
    assert body["trading_health_status"] == STATUS_INSUFFICIENT
    assert body["health"]["status"] == STATUS_INSUFFICIENT
    assert body["health"]["score"] is None
    assert body["health"]["trades_needed"] == MIN_TRADES_FOR_HEALTH
    assert len(body["equity_series"]) == 1
    assert float(body["equity_series"][0]["balance"]) == 1000.0
    daily = body["personal_daily_loss"]
    assert float(daily["limit"]) == 10.0
    assert float(daily["remaining"]) == float(daily["limit"])
    assert "distance_to_personal_daily_loss" in body
    assert float(body["personal_max_dd"]["limit"]) == 50.0
    assert float(body["firm_daily_dd"]["limit"]) == 60.0
    assert float(body["firm_max_dd"]["limit"]) == 90.0
    cc = body["command_center"]
    assert cc["account_status"] in {"STABLE", "CAUTION", "HALT"}
    assert "today_story" in cc
    assert "timeline" in cc
    assert "trading_capacity" in cc
    assert "insights" in cc


def test_dashboard_command_center_after_trades(client: TestClient) -> None:
    user = _register(client, "spark@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    _closed_trade(client, headers, account_id, day=0, win=True)
    dash = client.get(f"/api/dashboard?account_id={account_id}", headers=headers)
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert body["n_trades"] == 1
    assert body["health"]["status"] == STATUS_INSUFFICIENT
    assert len(body["equity_series"]) >= 2
    first = float(body["equity_series"][0]["balance"])
    last = float(body["equity_series"][-1]["balance"])
    assert first == 1000.0
    assert last > first


def test_dashboard_health_scored_after_threshold(client: TestClient) -> None:
    user = _register(client, "scored-dash@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    for i in range(MIN_TRADES_FOR_HEALTH):
        _closed_trade(client, headers, account_id, day=i, win=i % 3 != 0)
    dash = client.get(f"/api/dashboard?account_id={account_id}", headers=headers)
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert body["n_trades"] >= MIN_TRADES_FOR_HEALTH
    assert body["health"]["status"] == STATUS_SCORED
    assert isinstance(body["health"]["score"], int)
    assert 0 <= body["health"]["score"] <= 100
    assert body["health"]["trades_needed"] == 0
    assert body["trading_health"] == body["health"]["score"]
    assert len(body["equity_series"]) >= 2
