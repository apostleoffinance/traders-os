"""Opt-in journal Web Push — no trading signals."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import get_db
from app.db.base import Base
from app.main import app
from app.services import push_service
from app import models  # noqa: F401


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "vapid_public_key", "BTESTPUBLICKEY")
    monkeypatch.setattr(settings, "vapid_private_key", "test-private")
    monkeypatch.setattr(settings, "cron_secret", "cron-test-secret")
    monkeypatch.setattr(settings, "journal_reminder_hour", 18)
    monkeypatch.setattr(settings, "web_origin", "http://localhost:3000")

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


def _subscribe(client: TestClient, headers: dict, endpoint="https://push.example/sub-1") -> None:
    r = client.post(
        "/api/push/subscribe",
        headers=headers,
        json={"endpoint": endpoint, "keys": {"p256dh": "dGVzdHAyNTZkaA", "auth": "dGVzdGF1dGg"}},
    )
    assert r.status_code == 204, r.text


def _dispatch_now(now: datetime, sender) -> dict:
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        return push_service.dispatch_due(db, now=now, sender=sender)
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


def test_config_exposes_public_key_only(client: TestClient) -> None:
    r = client.get("/api/push/config")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["vapid_public_key"] == "BTESTPUBLICKEY"
    assert "private" not in r.text.lower()


def test_subscribe_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/push/subscribe",
        json={"endpoint": "https://push.example/x", "keys": {"p256dh": "dGVzdHAyNTZkaA", "auth": "dGVzdGF1dGg"}},
    )
    assert r.status_code == 401


def test_subscribe_enables_reminders(client: TestClient) -> None:
    user = _register(client, "nudge@example.com")
    headers = _headers(user["access_token"])
    assert user["user"]["reminders_enabled"] is False
    _subscribe(client, headers)
    me = client.get("/api/auth/me", headers=headers)
    assert me.json()["reminders_enabled"] is True
    off = client.delete("/api/push/subscribe", headers=headers)
    assert off.status_code == 204
    me = client.get("/api/auth/me", headers=headers)
    assert me.json()["reminders_enabled"] is False


def test_dispatch_rejects_bad_secret(client: TestClient) -> None:
    r = client.post("/api/push/dispatch", headers={"X-Cron-Secret": "nope"})
    assert r.status_code == 401


def test_dispatch_sends_when_not_journaled(client: TestClient) -> None:
    user = _register(client, "empty-day@example.com")
    headers = _headers(user["access_token"])
    _subscribe(client, headers)
    sent: list[dict] = []

    def fake_send(_row, payload):
        sent.append(payload)

    # 17:00 UTC = 18:00 Africa/Lagos
    now = datetime(2026, 8, 21, 17, 0, tzinfo=timezone.utc)
    result = _dispatch_now(now, fake_send)
    assert result["sent"] == 1
    assert sent
    assert sent[0]["body"] == "You haven't journaled today."
    assert "/trades/new" in sent[0]["url"]
    assert "buy" not in sent[0]["body"].lower()
    assert "sell" not in sent[0]["body"].lower()


def test_dispatch_skips_if_already_journaled(client: TestClient) -> None:
    user = _register(client, "logged@example.com")
    headers = _headers(user["access_token"])
    _subscribe(client, headers)
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
    trade = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": acc.json()["id"],
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": "2026-08-21T10:30:00+01:00",
            "timezone": "Africa/Lagos",
            "timeframe": "M15",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "0.05",
            "acknowledged_warnings": True,
        },
    )
    assert trade.status_code == 201, trade.text
    sender = MagicMock()
    now = datetime(2026, 8, 21, 17, 0, tzinfo=timezone.utc)
    result = _dispatch_now(now, sender)
    assert result["sent"] == 0
    sender.assert_not_called()


def test_dispatch_does_not_double_send(client: TestClient) -> None:
    user = _register(client, "once@example.com")
    headers = _headers(user["access_token"])
    _subscribe(client, headers)
    sender = MagicMock()
    now = datetime(2026, 8, 21, 17, 0, tzinfo=timezone.utc)
    first = _dispatch_now(now, sender)
    second = _dispatch_now(now, sender)
    assert first["sent"] == 1
    assert second["sent"] == 0
    assert sender.call_count == 1
