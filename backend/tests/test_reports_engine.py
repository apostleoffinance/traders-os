"""Tests for Performance Intelligence Report engine."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.reports.aggregator import build_performance_report
from app.engines.reports.confidence import confidence_level
from app.engines.reports.periods import resolve_report_period
from app.engines.reports.status import classify_performance_status
from app.core.enums import TradeResult, TradeStatus


def _row(pnl: Decimal, *, hour: int = 10, discipline: int = 80) -> AnalyticsTrade:
    entry = datetime(2026, 8, 5, hour, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 8, 5, hour, 30, tzinfo=timezone.utc)
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
        discipline_score=discipline,
        rules_followed=True,
        setup_valid=True,
    )


class _FakeTrade:
  def __init__(self, row: AnalyticsTrade):
    self.id = row.id
    self.symbol = row.symbol
    self.direction = row.direction
    self.session = row.session
    self.setup = None
    self.setup_id = None
    self.timeframe = row.timeframe
    self.trade_timestamp = row.entry_at
    self.exit_timestamp = row.exit_at
    self.entry_price = row.entry_price
    self.exit_price = row.exit_price
    self.lot_size = row.lot_size
    self.risk_amount = row.risk_amount
    self.risk_percent = row.risk_percent
    self.commission = row.commission
    self.swap = row.swap
    self.realized_pnl = row.realized_pnl
    self.realized_r = row.realized_r
    self.holding_time_seconds = row.holding_time_seconds
    self.mfe_price = None
    self.mae_price = None
    self.mfe_r = row.mfe_r
    self.mae_r = row.mae_r
    self.mfe_mae_source = row.mfe_mae_source
    self.result = row.result
    self.status = row.status
    self.psychology = None
    self.checklist_responses = []
    self.discipline_score = row.discipline_score
    self.setup_valid = row.setup_valid
    self.rules_followed = row.rules_followed
    self.emotional_trade = False
    self.mistake = False
    self.in_preferred_session = True
    self.source = "manual"


def test_resolve_monthly_period() -> None:
    meta = resolve_report_period("monthly", year=2026, month=8, timezone="UTC")
    assert meta["label"] == "August 2026"
    assert meta["period_key"] == "2026-08"
    assert meta["previous"]["label"] == "July 2026"


def test_confidence_insufficient() -> None:
    assert confidence_level(3) == "INSUFFICIENT_SAMPLE"
    assert confidence_level(25) == "MODERATE_CONFIDENCE"
    assert confidence_level(35) == "HIGH_CONFIDENCE"


def test_status_no_trades() -> None:
    s = classify_performance_status(
        n=0,
        net_pnl=None,
        expectancy_r=None,
        profit_factor=None,
        max_drawdown_pct=None,
        discipline_score=None,
        risk_violations=0,
        emotional_trades=0,
    )
    assert s["status"] == "NEEDS_ATTENTION"


def test_build_monthly_report_payload() -> None:
    rows = [_row(Decimal("20")), _row(Decimal("-10")), _row(Decimal("15")), _row(Decimal("5")), _row(Decimal("-8"))]
    trades = [_FakeTrade(r) for r in rows]
    period = resolve_report_period("monthly", year=2026, month=8, timezone="UTC")
    report = build_performance_report(
        trades,
        [],
        report_type="monthly",
        period_meta=period,
        account={"id": "acc-1", "name": "Demo", "currency": "USD", "firm": None, "starting_balance": "1000"},
        starting=Decimal("1000"),
        configured_risk=Decimal("10"),
        timezone="UTC",
    )
    assert report["version"] == "1.0"
    assert report["report"]["type"] == "monthly"
    assert report["executive_summary"]["scorecard"]["trades"] == 5
    assert "performance" in report
    assert "edge" in report
    assert "recommendations" in report
def test_build_quarterly_report_has_comparison() -> None:
    rows = [_row(Decimal("20")), _row(Decimal("-10")), _row(Decimal("15")), _row(Decimal("5")), _row(Decimal("-8"))]
    trades = [_FakeTrade(r) for r in rows]
    period = resolve_report_period("quarterly", year=2026, quarter=3, timezone="UTC")
    report = build_performance_report(
        trades,
        trades,
        report_type="quarterly",
        period_meta=period,
        account={"id": "acc-1", "name": "Demo", "currency": "USD", "firm": None, "starting_balance": "1000"},
        starting=Decimal("1000"),
        configured_risk=Decimal("10"),
        timezone="UTC",
    )
    assert report["comparison"] is not None
    assert report["comparison"]["available"] is True
    assert report.get("quarterly_focus", {}).get("question") == "Am I improving?"


def test_build_yearly_report_has_year_in_review() -> None:
    rows = [_row(Decimal("20")), _row(Decimal("-10"))]
    trades = [_FakeTrade(r) for r in rows]
    period = resolve_report_period("yearly", year=2026, timezone="UTC")
    report = build_performance_report(
        trades,
        None,
        report_type="yearly",
        period_meta=period,
        account={"id": "acc-1", "name": "Demo", "currency": "USD", "firm": None, "starting_balance": "1000"},
        starting=Decimal("1000"),
        configured_risk=Decimal("10"),
        timezone="UTC",
    )
    assert "year_in_review" in report
    assert report["year_in_review"]["title"] == "YOUR TRADING YEAR IN REVIEW"
