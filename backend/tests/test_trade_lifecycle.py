"""Trade lifecycle: OPEN → CLOSE, analytics exclusion, ownership."""

from __future__ import annotations

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.core.security import get_db
from app.db.base import Base
from app.main import app


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


def _account(client: TestClient, token: str) -> str:
    r = client.post(
        "/api/accounts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "Lifecycle",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _open_body(account_id: str) -> dict:
    return {
        "account_id": account_id,
        "symbol": "EURUSD",
        "direction": "short",
        "trade_timestamp": "2026-08-24T10:00:00+01:00",
        "timezone": "Africa/Lagos",
        "timeframe": "M15",
        "entry_price": "1.16646",
        "stop_loss": "1.17121",
        "take_profit": "1.15666",
        "lot_size": "0.01",
        "setup_valid": True,
        "rules_followed": True,
        "psychology": {"emotion_before": "calm"},
    }


def test_create_open_trade_without_exit(client: TestClient) -> None:
    auth = _register(client, "open@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    account_id = _account(client, auth["access_token"])

    trade = client.post("/api/trades", headers=headers, json=_open_body(account_id))
    assert trade.status_code == 201, trade.text
    body = trade.json()
    assert body["status"] == "open"
    assert body["result"] == "open"
    assert body["exit_price"] is None
    assert body["realized_pnl"] is None

    got = client.get(f"/api/trades/{body['id']}", headers=headers)
    assert got.status_code == 200
    assert got.json()["status"] == "open"


def test_edit_open_trade_and_close(client: TestClient) -> None:
    auth = _register(client, "close@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    account_id = _account(client, auth["access_token"])

    created = client.post("/api/trades", headers=headers, json=_open_body(account_id))
    assert created.status_code == 201, created.text
    trade_id = created.json()["id"]

    edited = client.put(
        f"/api/trades/{trade_id}",
        headers=headers,
        json={"notes": "still running", "lot_size": "0.01"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "open"
    assert edited.json()["notes"] == "still running"

    closed = client.post(
        f"/api/trades/{trade_id}/close",
        headers=headers,
        json={
            "exit_price": "1.16000",
            "exit_timestamp": "2026-08-24T12:00:00+01:00",
            "notes": "took profit early",
            "psychology": {"emotion_before": "calm", "emotion_after": "confident"},
        },
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["status"] == "closed"
    assert body["result"] == "win"
    assert Decimal(body["realized_pnl"]) > 0
    assert body["realized_r"] is not None
    assert Decimal(body["exit_price"]) == Decimal("1.16000")
    assert body["notes"] == "took profit early"

    again = client.post(
        f"/api/trades/{trade_id}/close",
        headers=headers,
        json={"exit_price": "1.16000"},
    )
    assert again.status_code == 409


def test_open_trade_excluded_from_dashboard_stats(client: TestClient) -> None:
    auth = _register(client, "stats@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    account_id = _account(client, auth["access_token"])

    open_trade = client.post("/api/trades", headers=headers, json=_open_body(account_id))
    assert open_trade.status_code == 201, open_trade.text

    dash = client.get(f"/api/dashboard?account_id={account_id}", headers=headers)
    assert dash.status_code == 200, dash.text
    body = dash.json()
    assert body["n_trades"] == 0
    assert Decimal(body["total_pnl"]) == Decimal("0")
    assert body["win_rate"] is None or Decimal(str(body["win_rate"])) == Decimal("0")

    trade_id = open_trade.json()["id"]
    closed = client.post(
        f"/api/trades/{trade_id}/close",
        headers=headers,
        json={"exit_price": "1.16000", "exit_timestamp": "2026-08-24T12:00:00+01:00"},
    )
    assert closed.status_code == 200, closed.text

    dash2 = client.get(f"/api/dashboard?account_id={account_id}", headers=headers)
    assert dash2.status_code == 200, dash2.text
    body2 = dash2.json()
    assert body2["n_trades"] == 1
    assert Decimal(body2["total_pnl"]) > 0


def test_user_cannot_close_another_users_trade(client: TestClient) -> None:
    a = _register(client, "owner@example.com")
    b = _register(client, "other@example.com")
    headers_a = {"Authorization": f"Bearer {a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {b['access_token']}"}
    account_id = _account(client, a["access_token"])

    trade = client.post("/api/trades", headers=headers_a, json=_open_body(account_id))
    assert trade.status_code == 201, trade.text
    trade_id = trade.json()["id"]

    stolen = client.post(
        f"/api/trades/{trade_id}/close",
        headers=headers_b,
        json={"exit_price": "1.16000"},
    )
    assert stolen.status_code == 404

    edited = client.put(
        f"/api/trades/{trade_id}",
        headers=headers_b,
        json={"notes": "hack"},
    )
    assert edited.status_code == 404


def test_list_filter_by_status(client: TestClient) -> None:
    auth = _register(client, "filter@example.com")
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    account_id = _account(client, auth["access_token"])

    open_trade = client.post("/api/trades", headers=headers, json=_open_body(account_id))
    assert open_trade.status_code == 201
    closed_body = _open_body(account_id)
    closed_body["exit_price"] = "1.16000"
    closed_body["exit_timestamp"] = "2026-08-24T12:00:00+01:00"
    closed = client.post("/api/trades", headers=headers, json=closed_body)
    assert closed.status_code == 201, closed.text
    assert closed.json()["status"] == "closed"

    opens = client.get(f"/api/trades?account_id={account_id}&status=open", headers=headers)
    assert opens.status_code == 200
    assert len(opens.json()) == 1
    assert opens.json()[0]["status"] == "open"

    closeds = client.get(f"/api/trades?account_id={account_id}&status=closed", headers=headers)
    assert closeds.status_code == 200
    assert len(closeds.json()) == 1
    assert closeds.json()[0]["status"] == "closed"
