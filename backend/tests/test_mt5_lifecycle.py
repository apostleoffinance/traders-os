from __future__ import annotations

from test_mt5_sync import _account, _connect, _register, _sync_body, client


def test_position_lifecycle_records_source_deals_and_snapshot_absence_without_inventing_close(client):
    auth = _register(client, "mt5lifecycle@example.com")
    account_id = _account(client, auth["access_token"])
    connector_token, connection_id = _connect(client, auth["access_token"], account_id)
    connector_headers = {"Authorization": f"Bearer {connector_token}"}
    user_headers = {"Authorization": f"Bearer {auth['access_token']}"}

    first = client.post(
        "/api/integrations/mt5/sync",
        headers=connector_headers,
        json=_sync_body(
            recent_deals=[{
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
            }],
        ),
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
    assert any(event["event_type"] == "source_deal" and event["external_deal_id"] == "lifecycle-1" for event in events)
    observations = [event for event in events if event["event_type"] == "snapshot_position_observation"]
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
