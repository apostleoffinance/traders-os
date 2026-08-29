"""Tests for performance consistency scorecard."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.consistency import build_consistency_scorecard
from app.engines.analytics_lab.trade_row import AnalyticsTrade


def _row(pnl: Decimal, day: int) -> AnalyticsTrade:
    entry = datetime(2026, 8, day, 10, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 8, day, 11, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{day}",
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
        commission=Decimal("0"),
        swap=Decimal("0"),
        realized_pnl=pnl,
        realized_r=pnl / Decimal("10"),
        holding_time_seconds=3600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        emotion_before="calm",
        discipline_score=80,
        rules_followed=True,
        setup_valid=True,
    )


def test_largest_losing_day_none_when_all_winning_days() -> None:
    rows = [_row(Decimal("20"), 5), _row(Decimal("8.20"), 6)]
    card = build_consistency_scorecard(rows, timezone="UTC")
    assert card["losing_days"] == 0
    assert card["largest_losing_day"] is None
    assert card["largest_winning_day"] == Decimal("20.00")


def test_largest_losing_day_from_negative_days_only() -> None:
    rows = [_row(Decimal("20"), 5), _row(Decimal("-15"), 6), _row(Decimal("-5"), 7)]
    card = build_consistency_scorecard(rows, timezone="UTC")
    assert card["losing_days"] == 2
    assert card["largest_losing_day"] == Decimal("-15.00")
