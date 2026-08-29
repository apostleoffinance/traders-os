"""Quant Lab API — regression tests for account metadata and endpoint health."""

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
from app.services.quant_lab_service import _lab_kwargs


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
            "firm": "TenTrade",
            "program": "TenEdge Instant",
            "account_name": "Quant Test",
            "starting_balance": "1000.00",
            "template": "tentrade_tenedge_1k",
        },
    )
    assert acc.status_code == 201, acc.text
    return acc.json()["id"]


def test_lab_kwargs_uses_account_name_not_name() -> None:
    class FakeAccount:
        account_name = "My Account"
        starting_balance = "1000"
        risk_profile = None

    kwargs = _lab_kwargs(FakeAccount(), {"preset": "all"})
    assert kwargs["account_name"] == "My Account"
    assert kwargs["configured_risk"] is None


def test_quant_lab_endpoint_returns_200(client: TestClient) -> None:
    auth = _register(client, "quant-lab@example.com")
    headers = _headers(auth["access_token"])
    account_id = _account(client, headers)

    r = client.get(f"/api/quant-lab?account_id={account_id}", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["meta"]["account_name"] == "Quant Test"
    assert "overview" in body
