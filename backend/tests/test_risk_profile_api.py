"""Risk policy save: valid saves, readable validation errors, and firm-daily-limit "None"."""

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


def _headers(client: TestClient) -> dict:
    r = client.post(
        "/api/auth/register",
        json={"email": "trader@example.com", "password": "password12", "display_name": "trader"},
    )
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _account_id(client: TestClient, headers: dict) -> str:
    created = client.post(
        "/api/accounts",
        headers=headers,
        json={
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "Main",
            "starting_balance": "1000.00",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


VALID_POLICY = {
    "risk_per_trade": "5.00",
    "personal_daily_loss_limit": "10.00",
    "personal_max_drawdown": "40.00",
    "firm_daily_drawdown_limit": "0",
    "firm_max_drawdown_limit": "60.00",
    "max_trades_per_day": 2,
    "preferred_min_rr": "1.5",
    "preferred_rr": "2.0",
    "minimum_trading_days": 0,
    "hard_risk_per_trade": "30.00",
    "risk_per_trade_enforcement": "block",
    "hard_risk_enforcement": "block",
}


def test_save_policy_with_valid_values_succeeds_and_persists(client: TestClient) -> None:
    headers = _headers(client)
    account_id = _account_id(client, headers)

    saved = client.put(f"/api/accounts/{account_id}/risk-profile", headers=headers, json=VALID_POLICY)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["firm_daily_drawdown_limit"] == "0.00"
    assert body["risk_per_trade_enforcement"] == "block"
    assert body["hard_risk_enforcement"] == "block"

    reloaded = client.get(f"/api/accounts/{account_id}/risk-profile", headers=headers)
    assert reloaded.status_code == 200
    reloaded_body = reloaded.json()
    assert reloaded_body["firm_daily_drawdown_limit"] == "0.00"
    assert reloaded_body["risk_per_trade_enforcement"] == "block"
    assert reloaded_body["hard_risk_enforcement"] == "block"
    assert reloaded_body["personal_max_drawdown"] == "40.00"


def test_firm_daily_drawdown_none_is_not_treated_as_zero_max_loss(client: TestClient) -> None:
    headers = _headers(client)
    account_id = _account_id(client, headers)

    payload = dict(VALID_POLICY, personal_daily_loss_limit="999.00")
    saved = client.put(f"/api/accounts/{account_id}/risk-profile", headers=headers, json=payload)
    assert saved.status_code == 200, saved.text


def test_risk_above_hard_cap_returns_readable_message(client: TestClient) -> None:
    headers = _headers(client)
    account_id = _account_id(client, headers)

    payload = dict(VALID_POLICY, risk_per_trade="35.00")
    resp = client.put(f"/api/accounts/{account_id}/risk-profile", headers=headers, json=payload)
    assert resp.status_code == 422
    body = resp.json()
    assert isinstance(body["message"], str)
    assert "Risk per trade must be below the hard risk cap." in body["message"]


def test_personal_drawdown_above_firm_drawdown_returns_readable_message(client: TestClient) -> None:
    headers = _headers(client)
    account_id = _account_id(client, headers)

    payload = dict(VALID_POLICY, personal_max_drawdown="90.00")
    resp = client.put(f"/api/accounts/{account_id}/risk-profile", headers=headers, json=payload)
    assert resp.status_code == 422
    body = resp.json()
    assert "Personal max drawdown must be below the firm max drawdown." in body["message"]


def test_preferred_rr_below_min_rr_returns_readable_message(client: TestClient) -> None:
    headers = _headers(client)
    account_id = _account_id(client, headers)

    payload = dict(VALID_POLICY, preferred_rr="1.0", preferred_min_rr="1.5")
    resp = client.put(f"/api/accounts/{account_id}/risk-profile", headers=headers, json=payload)
    assert resp.status_code == 422
    body = resp.json()
    assert "Preferred R:R must be greater than or equal to the minimum R:R." in body["message"]
