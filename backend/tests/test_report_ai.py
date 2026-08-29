"""Tests for report AI context and interpretation wiring."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401
from app.ai.orchestrator import run_analysis
from app.ai.providers.router import FailoverRouter
from app.ai.report_context import build_report_ai_context
from app.core.enums import TradeResult, TradeStatus
from app.db.base import Base
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.reports.aggregator import build_performance_report
from app.engines.reports.periods import resolve_report_period
from app.models.account import Account, AccountRiskProfile
from app.models.user import User


class ReportIntelProvider:
    name = "stub"

    def available(self) -> bool:
        return True

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        payload = {
            "period_label": "August 2026",
            "executive_summary": "August was profitable with moderate sample size. Process discipline held steady.",
            "key_observations": [
                {
                    "category": "performance",
                    "observation": "Expectancy was positive on 5 trades.",
                    "confidence": "INSUFFICIENT",
                    "evidence": ["n=5", "expectancy from scorecard"],
                }
            ],
            "keep": [{"text": "Continue journaling closed trades.", "evidence": ["n=5"]}],
            "review": [],
            "reduce": [],
            "data_limitations": ["Sample below research threshold."],
            "confidence": "INSUFFICIENT",
        }
        return json.dumps(payload), "stub-model"


def _row(pnl: Decimal) -> AnalyticsTrade:
    entry = datetime(2026, 8, 5, 10, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 8, 5, 10, 30, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{pnl}",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup="sweep",
        setup_id=None,
        timeframe="M15",
        entry_at=entry,
        exit_at=exit_at,
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.11"),
        lot_size=Decimal("0.1"),
        risk_amount=Decimal("10"),
        risk_percent=Decimal("1"),
        commission=Decimal("-0.5"),
        swap=Decimal("0"),
        realized_pnl=pnl,
        realized_r=pnl / Decimal("10"),
        holding_time_seconds=1800,
        mfe_price=None,
        mae_price=None,
        mfe_r=Decimal("1.5") if pnl > 0 else Decimal("0.5"),
        mae_r=Decimal("0.5"),
        mfe_mae_source="computed",
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        emotion_before="calm",
        discipline_score=85,
        rules_followed=True,
        setup_valid=True,
    )


def test_build_report_ai_context_includes_findings() -> None:
    rows = [_row(Decimal("20")), _row(Decimal("-10")), _row(Decimal("15"))]
    period = resolve_report_period("monthly", year=2026, month=8, timezone="UTC")

    class FakeTrade:
        def __init__(self, row: AnalyticsTrade):
            for attr in (
                "id", "symbol", "direction", "session", "timeframe", "entry_at", "exit_at",
                "entry_price", "exit_price", "lot_size", "risk_amount", "risk_percent",
                "commission", "swap", "realized_pnl", "realized_r", "holding_time_seconds",
                "mfe_price", "mae_price", "mfe_r", "mae_r", "mfe_mae_source", "result", "status",
                "discipline_score", "setup_valid", "rules_followed",
            ):
                setattr(self, attr, getattr(row, attr))
            self.setup = None
            self.setup_id = None
            self.trade_timestamp = row.entry_at
            self.exit_timestamp = row.exit_at
            self.psychology = None
            self.checklist_responses = []
            self.emotional_trade = False
            self.mistake = False
            self.in_preferred_session = True
            self.source = "manual"

    report = build_performance_report(
        [FakeTrade(r) for r in rows],
        [],
        report_type="monthly",
        period_meta=period,
        account={"id": "acc-1", "name": "Demo", "currency": "USD", "firm": None, "starting_balance": "1000"},
        starting=Decimal("1000"),
        configured_risk=Decimal("10"),
        timezone="UTC",
    )
    ctx = build_report_ai_context(report)
    assert ctx["period_label"] == "August 2026"
    assert ctx["scorecard"] is not None
    assert "performance_findings" in ctx
    assert "deterministic_recommendations" in ctx
    assert ctx["guardrails"]["min_sample_basic"] == 5


def test_report_intelligence_orchestrator() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    db = Session()
    user = User(email="report-ai@example.com", hashed_password="x", display_name="A", timezone="UTC")
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

    period = resolve_report_period("monthly", year=2026, month=8, timezone="UTC")
    rows = [_row(Decimal("10")), _row(Decimal("-5")), _row(Decimal("8"))]

    class FakeTrade:
        def __init__(self, row: AnalyticsTrade):
            for attr in (
                "id", "symbol", "direction", "session", "timeframe", "entry_at", "exit_at",
                "entry_price", "exit_price", "lot_size", "risk_amount", "risk_percent",
                "commission", "swap", "realized_pnl", "realized_r", "holding_time_seconds",
                "mfe_price", "mae_price", "mfe_r", "mae_r", "mfe_mae_source", "result", "status",
                "discipline_score", "setup_valid", "rules_followed",
            ):
                setattr(self, attr, getattr(row, attr))
            self.setup = None
            self.setup_id = None
            self.trade_timestamp = row.entry_at
            self.exit_timestamp = row.exit_at
            self.psychology = None
            self.checklist_responses = []
            self.emotional_trade = False
            self.mistake = False
            self.in_preferred_session = True
            self.source = "manual"

    report = build_performance_report(
        [FakeTrade(r) for r in rows],
        [],
        report_type="monthly",
        period_meta=period,
        account={"id": str(account.id), "name": "Test", "currency": "USD", "firm": None, "starting_balance": "1000"},
        starting=Decimal("1000"),
        configured_risk=Decimal("10"),
        timezone="UTC",
    )
    ctx = build_report_ai_context(report)
    router = FailoverRouter([ReportIntelProvider()])
    out = run_analysis(
        db,
        user_id=user.id,
        account_id=account.id,
        analysis_type="report_intelligence",
        task_prompt="interpret",
        context=ctx,
        router=router,
    )
    assert out["analysis_type"] == "report_intelligence"
    assert "executive_summary" in out["result"]
    assert out["result"]["confidence"] == "INSUFFICIENT"
    db.close()
