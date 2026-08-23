"""Tenant isolation: user A must never read user B's accounts or trades."""

from __future__ import annotations

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


def test_user_cannot_read_another_users_account(client: TestClient) -> None:
    a = _register(client, "a@example.com")
    b = _register(client, "b@example.com")

    created = client.post(
        "/api/accounts",
        headers={"Authorization": f"Bearer {a['access_token']}"},
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "A account",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert created.status_code == 201, created.text
    account_id = created.json()["id"]

    stolen = client.get(
        f"/api/accounts/{account_id}",
        headers={"Authorization": f"Bearer {b['access_token']}"},
    )
    assert stolen.status_code == 404

    listed = client.get(
        "/api/accounts",
        headers={"Authorization": f"Bearer {b['access_token']}"},
    )
    assert listed.status_code == 200
    assert listed.json() == []


def test_user_cannot_read_another_users_trade(client: TestClient) -> None:
    a = _register(client, "trader.a@example.com")
    b = _register(client, "trader.b@example.com")
    headers_a = {"Authorization": f"Bearer {a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {b['access_token']}"}

    acc = client.post(
        "/api/accounts",
        headers=headers_a,
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "A",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acc.status_code == 201, acc.text
    account_id = acc.json()["id"]

    trade = client.post(
        "/api/trades",
        headers=headers_a,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
            "exit_timestamp": "2026-03-10T09:00:00+01:00",
            "timezone": "Africa/Lagos",
            "timeframe": "M15",
            "entry_price": "1.08500",
            "exit_price": "1.08600",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "0.05",
            "setup_valid": True,
            "rules_followed": True,
        },
    )
    assert trade.status_code == 201, trade.text
    trade_id = trade.json()["id"]
    assert Decimal(trade.json()["realized_pnl"]) == Decimal("5.00")
    assert trade.json()["session"] in {
        "london",
        "london_ny_overlap",
        "asia",
        "new_york",
        "outside",
    }

    other = client.get(f"/api/trades/{trade_id}", headers=headers_b)
    assert other.status_code == 404

    dash = client.get(f"/api/dashboard?account_id={account_id}", headers=headers_b)
    assert dash.status_code == 404

    analytics = client.get(f"/api/analytics/dashboard?account_id={account_id}", headers=headers_b)
    assert analytics.status_code == 404


def test_analytics_dashboard_filters_by_date_and_account(client: TestClient) -> None:
    user = _register(client, "analytics@example.com")
    headers = {"Authorization": f"Bearer {user['access_token']}"}
    acc = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "A",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acc.status_code == 201, acc.text
    account_id = acc.json()["id"]
    base = {
        "account_id": account_id,
        "symbol": "EURUSD",
        "direction": "long",
        "timezone": "UTC",
        "timeframe": "M15",
        "entry_price": "1.08500",
        "exit_price": "1.08600",
        "stop_loss": "1.08400",
        "take_profit": "1.08700",
        "lot_size": "0.05",
        "setup_valid": True,
        "rules_followed": True,
    }
    t1 = client.post(
        "/api/trades",
        headers=headers,
        json={
            **base,
            "trade_timestamp": "2026-03-10T08:30:00+00:00",
            "exit_timestamp": "2026-03-10T09:00:00+00:00",
        },
    )
    t2 = client.post(
        "/api/trades",
        headers=headers,
        json={
            **base,
            "trade_timestamp": "2026-04-10T08:30:00+00:00",
            "exit_timestamp": "2026-04-10T09:00:00+00:00",
        },
    )
    assert t1.status_code == 201, t1.text
    assert t2.status_code == 201, t2.text

    all_rows = client.get(f"/api/analytics/dashboard?account_id={account_id}&preset=all", headers=headers)
    assert all_rows.status_code == 200, all_rows.text
    assert all_rows.json()["overview"]["n_trades"] == 2

    march = client.get(
        f"/api/analytics/dashboard?account_id={account_id}&preset=custom&date_from=2026-03-01&date_to=2026-03-31",
        headers=headers,
    )
    assert march.status_code == 200
    body = march.json()
    assert body["overview"]["n_trades"] == 1
    assert body["overview"]["evidence"]["level"] == "INSUFFICIENT"
    assert "sessions" in body
    assert "observations" in body
