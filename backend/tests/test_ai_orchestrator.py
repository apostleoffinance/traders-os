import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.ai.orchestrator import run_analysis
from app.ai.providers.router import FailoverRouter
from app.db.base import Base
from app.models.account import Account, AccountRiskProfile
from app.models.user import User
from app import models  # noqa: F401


class JsonProvider:
    name = "stub"

    def available(self) -> bool:
        return True

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        payload = {
            "summary": "Expectancy is negative on this 4-trade sample. Descriptive only.",
            "recent_performance": ["n=4"],
            "recurring_mistakes": [],
            "recurring_strengths": [],
            "psychology": [],
            "risk_behavior": [],
            "session_behavior": [],
            "setup_behavior": [],
            "questions_to_investigate": ["Is the sample large enough?"],
            "confidence": "INSUFFICIENT",
        }
        return json.dumps(payload), "stub-model"


def test_persist_and_cache_same_context() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    db = Session()
    user = User(email="ai@example.com", hashed_password="x", display_name="A", timezone="UTC")
    db.add(user)
    db.flush()
    account = Account(
        user_id=user.id,
        firm="TenTrade",
        program="TenEdge",
        account_name="Test",
        currency="USD",
        starting_balance="1000.00",
        current_balance="1000.00",
        current_equity="1000.00",
    )
    db.add(account)
    db.flush()
    db.add(
        AccountRiskProfile(
            account_id=account.id,
            risk_per_trade="5.00",
            personal_daily_loss_limit="10.00",
            personal_max_drawdown="50.00",
            firm_daily_drawdown_limit="60.00",
            firm_max_drawdown_limit="90.00",
            max_trades_per_day=2,
            preferred_min_rr="1.50",
        )
    )
    db.commit()

    router = FailoverRouter([JsonProvider()])
    ctx = {"n": 4, "expectancy_r": "-0.2"}
    first = run_analysis(
        db,
        user_id=user.id,
        account_id=account.id,
        analysis_type="journal_summary",
        task_prompt="summarize",
        context=ctx,
        router=router,
    )
    second = run_analysis(
        db,
        user_id=user.id,
        account_id=account.id,
        analysis_type="journal_summary",
        task_prompt="summarize",
        context=ctx,
        router=router,
    )
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["id"] == first["id"]
    db.close()
