"""Screenshot bytes stored in Postgres when STORAGE_BACKEND=db."""

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
from app.models.trade import TradeScreenshot


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "db")
    from app.core.config import settings
    from app.storage.factory import get_storage

    settings.storage_backend = "db"
    settings.storage_max_upload_bytes = 1_572_864
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
        yield c, TestingSession
    app.dependency_overrides.clear()
    get_storage.cache_clear()


def _auth_trade(client: TestClient) -> tuple[str, str]:
    reg = client.post(
        "/api/auth/register",
        json={"email": "dbshots@example.com", "password": "password12", "display_name": "DbShots"},
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
            "account_name": "DbShots",
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


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_db_backend_stores_and_serves_bytes(client):
    c, Session = client
    token, trade_id = _auth_trade(c)
    headers = {"Authorization": f"Bearer {token}"}

    up = c.post(
        f"/api/trades/{trade_id}/screenshots",
        headers=headers,
        files={"file": ("a.png", io.BytesIO(_png()), "image/png")},
        data={"type": "entry"},
    )
    assert up.status_code == 201, up.text
    key = up.json()["storage_key"]
    url = up.json()["url"]

    db = Session()
    try:
        shot = db.query(TradeScreenshot).filter(TradeScreenshot.storage_key == key).one()
        assert shot.file_data is not None
        assert bytes(shot.file_data).startswith(b"\x89PNG")
    finally:
        db.close()

    media = c.get(url, headers=headers)
    assert media.status_code == 200
    assert media.content.startswith(b"\x89PNG")


def test_db_backend_rejects_oversized_upload(client, monkeypatch):
    c, _Session = client
    from app.core.config import settings

    settings.storage_max_upload_bytes = 100
    token, trade_id = _auth_trade(c)
    headers = {"Authorization": f"Bearer {token}"}
    big = _png() + (b"x" * 200)
    up = c.post(
        f"/api/trades/{trade_id}/screenshots",
        headers=headers,
        files={"file": ("big.png", io.BytesIO(big), "image/png")},
        data={"type": "entry"},
    )
    assert up.status_code == 400
    assert "too large" in up.text.lower() or "too large" in str(up.json()).lower()
