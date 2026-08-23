from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_views import (
    JournalTrade,
    after_consecutive_losses,
    frequency_buckets,
    r_distribution,
    streak_histogram,
)
from app.engines.evidence import EvidenceLevel, classify_confidence
from app.engines.performance_engine import compute_performance
from app.engines.analytics_views import to_closed


def _jt(
    i: int,
    *,
    pnl: Decimal,
    risk: Decimal = Decimal("5"),
    session: str = "london",
    day: int | None = None,
    result: TradeResult | None = None,
) -> JournalTrade:
    ts = datetime(2026, 3, 2, 10, 0, tzinfo=ZoneInfo("UTC")) + timedelta(days=day if day is not None else i)
    if result is None:
        result = TradeResult.WIN if pnl > 0 else TradeResult.LOSS
    return JournalTrade(
        id=str(i),
        symbol="EURUSD",
        session=session,
        setup="sweep",
        direction="long",
        timeframe="M15",
        result=result,
        status=TradeStatus.CLOSED,
        entry_at=ts,
        exit_at=ts + timedelta(hours=1),
        risk_amount=risk,
        risk_percent=Decimal("0.5"),
        realized_pnl=pnl,
        realized_r=pnl / risk,
        holding_time_seconds=3600,
        emotion_before="calm",
        discipline_score=80,
    )


def test_expectancy_unchanged_through_journal_adapter() -> None:
    trades = [_jt(0, pnl=Decimal("10")), _jt(1, pnl=Decimal("-5")), _jt(2, pnl=Decimal("5"))]
    m = compute_performance([to_closed(t) for t in trades], Decimal("1000"))
    assert m.expectancy_r == Decimal("0.67")


def test_r_distribution_exposes_mean_and_sample() -> None:
    trades = [_jt(0, pnl=Decimal("10")), _jt(1, pnl=Decimal("-5"))]
    dist = r_distribution(trades)
    assert dist["n"] == 2
    assert dist["mean"] == Decimal("0.50")
    assert dist["evidence"]["level"] == EvidenceLevel.INSUFFICIENT.value


def test_frequency_buckets_group_by_local_day() -> None:
    trades = [
        _jt(0, pnl=Decimal("5"), day=0),
        _jt(1, pnl=Decimal("5"), day=0),
        _jt(2, pnl=Decimal("-5"), day=1),
    ]
    rows = {r["key"]: r for r in frequency_buckets(trades, Decimal("1000"), "UTC")}
    assert rows["2"]["trading_days"] == 1
    assert rows["2"]["n"] == 2
    assert rows["1"]["n"] == 1


def test_streak_histogram_counts_loss_runs() -> None:
    trades = [
        _jt(0, pnl=Decimal("-5")),
        _jt(1, pnl=Decimal("-5")),
        _jt(2, pnl=Decimal("5")),
        _jt(3, pnl=Decimal("-5")),
    ]
    hist = streak_histogram(trades)
    assert hist["longest_losses"] == 2
    assert hist["current_losses"] == 1
    lengths = {row["length"]: row["occurrences"] for row in hist["loss_distribution"]}
    assert lengths[2] == 1
    assert lengths[1] == 1


def test_after_two_losses_excludes_the_losses_themselves() -> None:
    trades = [
        _jt(0, pnl=Decimal("-5")),
        _jt(1, pnl=Decimal("-5")),
        _jt(2, pnl=Decimal("10")),
        _jt(3, pnl=Decimal("-5")),
    ]
    row = after_consecutive_losses(trades, Decimal("1000"), 2)
    assert row["n"] == 1
    assert row["expectancy_r"] == Decimal("2.00")


def test_evidence_gates() -> None:
    assert classify_confidence(4).value == "INSUFFICIENT"
    assert classify_confidence(10).value == "LOW"
    assert classify_confidence(30).value == "MODERATE"
    assert classify_confidence(80).value == "HIGH"
