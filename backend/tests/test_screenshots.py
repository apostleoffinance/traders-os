"""Screenshot upload replaces same-type charts and serves media."""

from __future__ import annotations

import io

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
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("STORAGE_LOCAL_PATH", str(tmp_path / "uploads"))
    from app.core.config import settings
    from app.storage.factory import get_storage

    settings.storage_backend = "local"
    settings.storage_local_path = str(tmp_path / "uploads")
    get_storage.cache_clear()

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
    get_storage.cache_clear()


def _auth_trade(client: TestClient) -> tuple[str, str]:
    reg = client.post(
        "/api/auth/register",
        json={"email": "shots@example.com", "password": "password12", "display_name": "Shots"},
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    acct = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "Shots",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acct.status_code == 201, acct.text
    trade = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": acct.json()["id"],
            "symbol": "EURUSD",
            "direction": "short",
            "trade_timestamp": "2026-08-24T10:00:00+01:00",
            "timezone": "Africa/Lagos",
            "timeframe": "H4",
            "entry_price": "1.16646",
            "stop_loss": "1.17121",
            "take_profit": "1.15666",
            "lot_size": "0.01",
            "setup_valid": True,
            "rules_followed": True,
            "emotional_trade": False,
        },
    )
    assert trade.status_code == 201, trade.text
    return token, trade.json()["id"]


def _png(label: bytes) -> bytes:
    # Minimal valid 1x1 PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82" + label
    )


def test_reupload_replaces_entry_screenshot(client: TestClient):
    token, trade_id = _auth_trade(client)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(
        f"/api/trades/{trade_id}/screenshots",
        headers=headers,
        files={"file": ("a.png", io.BytesIO(_png(b"a")), "image/png")},
        data={"type": "entry"},
    )
    assert first.status_code == 201, first.text
    first_key = first.json()["storage_key"]
    first_url = first.json()["url"]

    media1 = client.get(first_url, headers=headers)
    assert media1.status_code == 200

    second = client.post(
        f"/api/trades/{trade_id}/screenshots",
        headers=headers,
        files={"file": ("b.png", io.BytesIO(_png(b"b")), "image/png")},
        data={"type": "entry"},
    )
    assert second.status_code == 201, second.text
    second_key = second.json()["storage_key"]
    assert second_key != first_key

    detail = client.get(f"/api/trades/{trade_id}", headers=headers)
    assert detail.status_code == 200
    entries = [s for s in detail.json()["screenshots"] if s["type"] == "entry"]
    assert len(entries) == 1
    assert entries[0]["storage_key"] == second_key

    media_old = client.get(first_url, headers=headers)
    assert media_old.status_code == 404

    media_new = client.get(second.json()["url"], headers=headers)
    assert media_new.status_code == 200
