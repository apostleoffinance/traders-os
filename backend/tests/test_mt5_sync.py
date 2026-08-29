"""MT5 sync: connector auth, idempotency, lifecycle, tenant isolation."""

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
            "account_name": "MT5 Test",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _connect(client: TestClient, user_token: str, account_id: str) -> tuple[str, str]:
    r = client.post(
        "/api/integrations/mt5/connections",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"account_id": account_id},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    return body["connection_token"], body["id"]


def _position_payload(position_id: str = "10001") -> dict:
    return {
        "external_position_id": position_id,
        "symbol_raw": "EURUSD.a",
        "direction": "SHORT",
        "volume": "0.01",
        "entry_price": "1.16646",
        "current_price": "1.16520",
        "stop_loss": "1.17121",
        "take_profit": "1.15666",
        "opened_at": "2026-08-24T09:30:00+00:00",
        "unrealized_pnl": "1.26",
        "commission": "0",
        "swap": "0",
    }


def _sync_body(**overrides) -> dict:
    body = {
        "event_type": "sync",
        "platform": "MT5",
        "sync_timestamp": "2026-08-24T10:00:00+00:00",
        "terminal_connected": True,
        "account": {
            "login": 12345678,
            "server": "MetaQuotes-Demo",
            "company": "MetaQuotes Ltd.",
            "currency": "USD",
        },
        "positions": [_position_payload()],
        "recent_deals": [],
    }
    body.update(overrides)
    return body


def test_connector_token_auth_and_sync_creates_trade(client: TestClient) -> None:
    auth = _register(client, "mt5a@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)

    sync = client.post(
        "/api/integrations/mt5/sync",
        headers={"Authorization": f"Bearer {connector_token}"},
        json=_sync_body(),
    )
    assert sync.status_code == 200, sync.text
    assert sync.json()["trades_created"] == 1

    trades = client.get(
        f"/api/trades?account_id={account_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    assert trades.status_code == 200
    rows = trades.json()
    assert len(rows) == 1
    assert rows[0]["symbol"] == "EURUSD"
    assert rows[0]["source"] == "mt5"
    assert rows[0]["status"] == "open"
    assert rows[0]["external_position_id"] == "10001"


def test_invalid_connector_rejected(client: TestClient) -> None:
    r = client.post(
        "/api/integrations/mt5/sync",
        headers={"Authorization": "Bearer TOS-INVALID-TOKEN"},
        json=_sync_body(),
    )
    assert r.status_code == 401


def test_idempotent_position_sync(client: TestClient) -> None:
    auth = _register(client, "mt5b@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)
    headers = {"Authorization": f"Bearer {connector_token}"}

    first = client.post("/api/integrations/mt5/sync", headers=headers, json=_sync_body())
    assert first.status_code == 200
    second = client.post("/api/integrations/mt5/sync", headers=headers, json=_sync_body())
    assert second.status_code == 200
    assert second.json()["trades_created"] == 0
    assert second.json()["trades_updated"] == 1

    trades = client.get(
        f"/api/trades?account_id={account_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    assert len(trades.json()) == 1


def test_close_deal_closes_trade(client: TestClient) -> None:
    auth = _register(client, "mt5c@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)
    headers = {"Authorization": f"Bearer {connector_token}"}

    client.post("/api/integrations/mt5/sync", headers=headers, json=_sync_body())

    close_body = _sync_body(
        positions=[],
        recent_deals=[
            {
                "external_deal_id": "9001",
                "external_position_id": "10001",
                "symbol_raw": "EURUSD.a",
                "direction": "SHORT",
                "entry_type": "OUT",
                "volume": "0.01",
                "price": "1.16500",
                "profit": "1.46",
                "commission": "-0.04",
                "swap": "0",
                "deal_time": "2026-08-24T11:00:00+00:00",
            }
        ],
    )
    closed = client.post("/api/integrations/mt5/sync", headers=headers, json=close_body)
    assert closed.status_code == 200, closed.text
    assert closed.json()["trades_closed"] == 1

    trades = client.get(
        f"/api/trades?account_id={account_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    trade = trades.json()[0]
    assert trade["status"] == "closed"
    assert Decimal(trade["exit_price"]) == Decimal("1.16500")


def test_duplicate_deal_ignored(client: TestClient) -> None:
    auth = _register(client, "mt5d@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)
    headers = {"Authorization": f"Bearer {connector_token}"}

    client.post("/api/integrations/mt5/sync", headers=headers, json=_sync_body())
    close_body = _sync_body(
        positions=[],
        recent_deals=[
            {
                "external_deal_id": "9002",
                "external_position_id": "10001",
                "symbol_raw": "EURUSD.a",
                "direction": "SHORT",
                "entry_type": "OUT",
                "volume": "0.01",
                "price": "1.16500",
                "profit": "1.46",
                "commission": "0",
                "swap": "0",
                "deal_time": "2026-08-24T11:00:00+00:00",
            }
        ],
    )
    client.post("/api/integrations/mt5/sync", headers=headers, json=close_body)
    again = client.post("/api/integrations/mt5/sync", headers=headers, json=close_body)
    assert again.status_code == 200
    assert again.json()["trades_closed"] == 0


def test_sync_does_not_overwrite_trader_notes(client: TestClient) -> None:
    auth = _register(client, "mt5e@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)
    headers = {"Authorization": f"Bearer {connector_token}"}

    client.post("/api/integrations/mt5/sync", headers=headers, json=_sync_body())
    trades = client.get(
        f"/api/trades?account_id={account_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    trade_id = trades.json()[0]["id"]

    client.put(
        f"/api/trades/{trade_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
        json={"notes": "My thesis — do not overwrite"},
    )

    client.post(
        "/api/integrations/mt5/sync",
        headers=headers,
        json=_sync_body(positions=[{**_position_payload(), "stop_loss": "1.17200"}]),
    )
    got = client.get(
        f"/api/trades/{trade_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    body = got.json()
    assert body["notes"] == "My thesis — do not overwrite"
    assert Decimal(body["stop_loss"]) == Decimal("1.17200")


def test_tenant_isolation(client: TestClient) -> None:
    auth_a = _register(client, "mt5usera@example.com")
    auth_b = _register(client, "mt5userb@example.com")
    account_a = _account(client, auth_a["access_token"])
    account_b = _account(client, auth_b["access_token"])
    token_a, _ = _connect(client, auth_a["access_token"], account_a)

    client.post(
        "/api/integrations/mt5/sync",
        headers={"Authorization": f"Bearer {token_a}"},
        json=_sync_body(),
    )

    trades_b = client.get(
        f"/api/trades?account_id={account_b}",
        headers={"Authorization": f"Bearer {auth_b['access_token']}"},
    )
    assert trades_b.json() == []


def test_symbol_normalization_unresolved(client: TestClient) -> None:
    from app.integrations.mt5.normalizer import resolve_mt5_symbol

    assert resolve_mt5_symbol("EURUSD.a").symbol == "EURUSD"
    assert resolve_mt5_symbol("EURUSDm").symbol == "EURUSD"
    unknown = resolve_mt5_symbol("FOOBARXYZ")
    assert unknown.instrument_status.value == "unresolved"

    auth = _register(client, "mt5f@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, _ = _connect(client, auth["access_token"], account_id)
    body = _sync_body(
        positions=[{**_position_payload(), "symbol_raw": "FOOBARXYZ"}],
    )
    sync = client.post(
        "/api/integrations/mt5/sync",
        headers={"Authorization": f"Bearer {connector_token}"},
        json=body,
    )
    assert sync.status_code == 200
    trade = client.get(
        f"/api/trades?account_id={account_id}",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    ).json()[0]
    assert trade["instrument_status"] == "unresolved"


def test_list_mt5_connections_per_user(client: TestClient) -> None:
    auth = _register(client, "mt5list@example.com")
    account_a = _account(client, auth["access_token"])
    _account(client, auth["access_token"])
    _connect(client, auth["access_token"], account_a)

    listed = client.get(
        "/api/integrations/mt5/connections",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert body[0]["account_id"] == account_a

    other = _register(client, "mt5list2@example.com")
    isolated = client.get(
        "/api/integrations/mt5/connections",
        headers={"Authorization": f"Bearer {other['access_token']}"},
    )
    assert isolated.status_code == 200
    assert isolated.json() == []


def test_revoked_connector_rejected(client: TestClient) -> None:
    auth = _register(client, "mt5g@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, connection_id = _connect(client, auth["access_token"], account_id)

    revoke = client.post(
        f"/api/integrations/mt5/connections/{connection_id}/revoke",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
    )
    assert revoke.status_code == 200

    sync = client.post(
        "/api/integrations/mt5/sync",
        headers={"Authorization": f"Bearer {connector_token}"},
        json=_sync_body(),
    )
    assert sync.status_code == 403
