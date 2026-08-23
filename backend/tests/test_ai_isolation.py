from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_db
from app.db.base import Base
from app.main import app
from app import models  # noqa: F401


def test_user_cannot_read_other_users_ai_widget() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)

    def _override():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    try:
        with TestClient(app) as client:
            a = client.post(
                "/api/auth/register",
                json={"email": "ai.a@example.com", "password": "password12"},
            )
            b = client.post(
                "/api/auth/register",
                json={"email": "ai.b@example.com", "password": "password12"},
            )
            assert a.status_code == 201
            acc = client.post(
                "/api/accounts",
                headers={"Authorization": f"Bearer {a.json()['access_token']}"},
                json={
                    "firm": "TenTrade",
                    "program": "TenEdge Instant",
                    "account_name": "A",
                    "starting_balance": "1000.00",
                    "template": "tentrade_tenedge_1k",
                },
            )
            assert acc.status_code == 201
            stolen = client.get(
                f"/api/ai/accounts/{acc.json()['id']}/widget",
                headers={"Authorization": f"Bearer {b.json()['access_token']}"},
            )
            assert stolen.status_code == 404
    finally:
        app.dependency_overrides.clear()
