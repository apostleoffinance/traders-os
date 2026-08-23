"""Pre-trade checklist templates, auto vs manual, and tenant isolation."""

from __future__ import annotations

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


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _account(client: TestClient, headers: dict) -> str:
    acc = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "ExampleFirm",
            "program": "Instant",
            "account_name": "Test account",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acc.status_code == 201, acc.text
    return acc.json()["id"]


def test_default_checklist_does_not_include_instrument(client: TestClient) -> None:
    user = _register(client, "chk@example.com")
    headers = _headers(user["access_token"])
    tmpl = client.get("/api/checklists/default", headers=headers)
    assert tmpl.status_code == 200, tmpl.text
    labels = [i["label"].upper().replace("/", "") for i in tmpl.json()["items"]]
    assert "EURUSD" not in labels
    assert any(i["kind"] == "automatic" and i["auto_key"] == "risk_per_trade" for i in tmpl.json()["items"])
    assert any(i["kind"] == "manual" for i in tmpl.json()["items"])


def test_setup_templates_differ(client: TestClient) -> None:
    user = _register(client, "setups@example.com")
    headers = _headers(user["access_token"])
    setups = client.get("/api/setups", headers=headers).json()
    sweep = next(s for s in setups if s["name"] == "Liquidity Sweep")
    brk = next(s for s in setups if s["name"] == "Breakout")
    a = client.get(f"/api/checklists?setup_id={sweep['id']}", headers=headers).json()
    b = client.get(f"/api/checklists?setup_id={brk['id']}", headers=headers).json()
    a_labels = {i["label"] for i in a["items"] if i["kind"] == "manual"}
    b_labels = {i["label"] for i in b["items"] if i["kind"] == "manual"}
    assert "Liquidity swept" in a_labels
    assert "Liquidity swept" not in b_labels
    assert "Breakout confirmed" in b_labels


def test_user_cannot_read_another_users_checklist(client: TestClient) -> None:
    a = _register(client, "ownera@example.com")
    b = _register(client, "ownerb@example.com")
    headers_a = _headers(a["access_token"])
    headers_b = _headers(b["access_token"])
    tmpl = client.get("/api/checklists/default", headers=headers_a).json()
    stolen = client.get(f"/api/checklists/templates/{tmpl['id']}", headers=headers_b)
    assert stolen.status_code == 404
    listed = client.get("/api/checklists/templates", headers=headers_b).json()
    ids = {t["id"] for t in listed}
    assert tmpl["id"] not in ids


def test_preview_auto_checks_not_client_ticked(client: TestClient) -> None:
    user = _register(client, "preview@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    preview = client.post(
        "/api/trades/preview",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "0.05",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    keys = {c["auto_key"] for c in body["auto_checks"]}
    assert {"risk_per_trade", "planned_rr", "session", "trades_today", "drawdown"} <= keys
    risk = next(c for c in body["auto_checks"] if c["auto_key"] == "risk_per_trade")
    assert risk["passed"] is True
    assert "$5.00" in risk["display"]
    assert body["session"] in {"london", "london_ny_overlap", "asia", "new_york", "outside"}


def test_auto_fail_does_not_override_hard_block(client: TestClient) -> None:
    user = _register(client, "block@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    # 1.0 lot on EURUSD 10-pip stop is $100 risk, above $10 hard limit
    preview = client.post(
        "/api/trades/preview",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "1.0",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
        },
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["process_status"] == "blocked"
    assert body["policy"]["allowed"] is False
    assert body["policy"]["requires_confirmation"] is False
    risk = next(c for c in body["auto_checks"] if c["auto_key"] == "risk_per_trade")
    assert risk["status"] == "blocked"

    trade = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
            "timezone": "Africa/Lagos",
            "timeframe": "M15",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "1.0",
            "acknowledged_warnings": True,
        },
    )
    assert trade.status_code == 409, trade.text
    assert trade.json()["detail"]["code"] == "policy_blocked"


def test_trade_persists_engine_auto_results_not_client_ticks(client: TestClient) -> None:
    user = _register(client, "persist@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    setups = client.get("/api/setups", headers=headers).json()
    sweep = next(s for s in setups if s["name"] == "Liquidity Sweep")
    tmpl = client.get(f"/api/checklists?setup_id={sweep['id']}", headers=headers).json()
    auto_item = next(i for i in tmpl["items"] if i["auto_key"] == "risk_per_trade")
    manuals = [i for i in tmpl["items"] if i["kind"] == "manual"]

    trade = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "GBPUSD",
            "direction": "long",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
            "timezone": "Africa/Lagos",
            "setup_id": sweep["id"],
            "timeframe": "M15",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "0.05",
            "checklist": [
                {"item_id": auto_item["id"], "checked": False},
                *[{"item_id": i["id"], "checked": True} for i in manuals],
            ],
        },
    )
    assert trade.status_code == 201, trade.text
    saved = {c["item_id"]: c for c in trade.json()["checklist"]}
    assert saved[auto_item["id"]]["checked"] is True
    assert saved[auto_item["id"]]["kind"] == "automatic"
    assert trade.json()["symbol"] == "GBPUSD"


def test_incomplete_required_manuals_still_journal(client: TestClient) -> None:
    user = _register(client, "incomplete@example.com")
    headers = _headers(user["access_token"])
    account_id = _account(client, headers)
    setups = client.get("/api/setups", headers=headers).json()
    sweep = next(s for s in setups if s["name"] == "Liquidity Sweep")
    trade = client.post(
        "/api/trades",
        headers=headers,
        json={
            "account_id": account_id,
            "symbol": "EURUSD",
            "direction": "long",
            "trade_timestamp": "2026-03-10T08:30:00+01:00",
            "timezone": "Africa/Lagos",
            "setup_id": sweep["id"],
            "timeframe": "M15",
            "entry_price": "1.08500",
            "stop_loss": "1.08400",
            "take_profit": "1.08700",
            "lot_size": "0.05",
            "checklist": [],
        },
    )
    assert trade.status_code == 201, trade.text
    manuals = [c for c in trade.json()["checklist"] if c["kind"] == "manual"]
    assert manuals
    assert all(c["checked"] is False for c in manuals)
    events = client.get(f"/api/risk/events?account_id={account_id}", headers=headers).json()
    assert any(e["event_type"] == "checklist_incomplete" for e in events)


def test_instruments_catalog(client: TestClient) -> None:
    user = _register(client, "inst@example.com")
    headers = _headers(user["access_token"])
    r = client.get("/api/instruments", headers=headers)
    assert r.status_code == 200
    symbols = [i["symbol"] for i in r.json()["instruments"]]
    assert "EURUSD" in symbols
    assert "XAUUSD" in symbols
    assert "GBPUSD" in symbols
