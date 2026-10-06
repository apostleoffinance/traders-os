from __future__ import annotations

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
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def override_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _register(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password12", "display_name": email.split("@")[0]},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _account(client: TestClient, token: str) -> str:
    response = client.post(
        "/api/accounts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "MT5 Lifecycle Test",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _connect(client: TestClient, user_token: str, account_id: str) -> tuple[str, str]:
    response = client.post(
        "/api/integrations/mt5/connections",
        headers={"Authorization": f"Bearer {user_token}"},
        json={"account_id": account_id},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["connection_token"], body["id"]


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
        "positions": [{
            "external_position_id": "10001",
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
        }],
        "recent_deals": [],
    }
    body.update(overrides)
    return body


def test_position_lifecycle_records_source_deals_and_snapshot_absence_without_inventing_close(client):
    auth = _register(client, "mt5lifecycle@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, connection_id = _connect(client, auth["access_token"], account_id)
    connector_headers = {"Authorization": f"Bearer {connector_token}"}
    user_headers = {"Authorization": f"Bearer {auth['access_token']}"}

    first = client.post(
        "/api/integrations/mt5/sync",
        headers=connector_headers,
        json=_sync_body(recent_deals=[{
            "external_deal_id": "lifecycle-1",
            "external_position_id": "10001",
            "symbol_raw": "EURUSD.a",
            "direction": "SHORT",
            "entry_type": "IN",
            "volume": "0.01",
            "price": "1.16646",
            "profit": "0",
            "commission": "-0.02",
            "swap": "0",
            "deal_time": "2026-08-24T09:30:00+00:00",
        }]),
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/integrations/mt5/sync",
        headers=connector_headers,
        json=_sync_body(
            sync_timestamp="2026-08-24T10:01:00+00:00",
            positions=[],
            recent_deals=[],
        ),
    )
    assert second.status_code == 200, second.text

    response = client.get(
        f"/api/integrations/mt5/connections/{connection_id}/lifecycle?position_id=10001",
        headers=user_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["coverage"]["snapshots_scanned"] == 2
    assert body["coverage"]["snapshot_history_complete"] is False
    assert len(body["positions"]) == 1
    events = body["positions"][0]["events"]
    assert any(
        event["event_type"] == "source_deal" and event["external_deal_id"] == "lifecycle-1"
        for event in events
    )
    observations = [
        event for event in events if event["event_type"] == "snapshot_position_observation"
    ]
    assert [event["state"] for event in observations] == ["present", "absent"]
    assert not any(event["event_type"] == "position_closed" for event in events)


def test_position_lifecycle_hides_foreign_connections(client):
    owner = _register(client, "mt5lifecycleowner@example.com")
    account_id = _account(client, owner["access_token"])
    _, connection_id = _connect(client, owner["access_token"], account_id)
    stranger = _register(client, "mt5lifecyclestranger@example.com")

    response = client.get(
        f"/api/integrations/mt5/connections/{connection_id}/lifecycle",
        headers={"Authorization": f"Bearer {stranger['access_token']}"},
    )
    assert response.status_code == 404
