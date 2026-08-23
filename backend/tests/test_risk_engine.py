from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.enums import RiskStatus, TradeResult, TradeStatus
from app.engines.risk_engine import ClosedTrade, RiskProfileView, build_equity_curve, compute_risk_snapshot

TZ = "Africa/Lagos"
START = Decimal("1000.00")


def _profile() -> RiskProfileView:
    return RiskProfileView(
        risk_per_trade=Decimal("5.00"),
        personal_daily_loss_limit=Decimal("10.00"),
        personal_max_drawdown=Decimal("50.00"),
        firm_daily_drawdown_limit=Decimal("60.00"),
        firm_max_drawdown_limit=Decimal("90.00"),
        max_trades_per_day=2,
        preferred_min_rr=Decimal("1.50"),
    )


def _t(
    i: int,
    pnl: Decimal,
    risk: Decimal = Decimal("5.00"),
    day_offset: int = 0,
    result: TradeResult | None = None,
) -> ClosedTrade:
    base = datetime(2026, 3, 10, 8, 0, tzinfo=ZoneInfo("Africa/Lagos")) + timedelta(days=day_offset, minutes=i * 30)
    if result is None:
        result = TradeResult.WIN if pnl > 0 else TradeResult.LOSS if pnl < 0 else TradeResult.BREAKEVEN
    return ClosedTrade(
        id=str(i),
        entry_at=base,
        exit_at=base + timedelta(minutes=20),
        risk_amount=risk,
        realized_pnl=pnl,
        result=result,
        status=TradeStatus.CLOSED,
    )


def test_drawdown_from_high_water_mark() -> None:
    trades = [
        _t(0, Decimal("20.00")),  # equity 1020
        _t(1, Decimal("10.00")),  # 1030 peak
        _t(2, Decimal("-30.00")),  # 1000, DD = 30
    ]
    curve = build_equity_curve(START, trades)
    assert curve[-1].equity == Decimal("1000.00")
    assert curve[-1].peak == Decimal("1030.00")
    assert curve[-1].drawdown == Decimal("30.00")


def test_personal_daily_loss_turns_red() -> None:
    now = datetime(2026, 3, 10, 16, 0, tzinfo=ZoneInfo("Africa/Lagos"))
    trades = [
        _t(0, Decimal("-5.00")),
        _t(1, Decimal("-5.00")),
    ]
    snap = compute_risk_snapshot(
        starting_balance=START,
        profile=_profile(),
        trades=trades,
        now=now,
        timezone=TZ,
    )
    assert snap.daily_pnl == Decimal("-10.00")
    assert snap.status == RiskStatus.RED
    assert any("personal daily loss" in r.lower() for r in snap.reasons)


def test_risk_escalation_yellow() -> None:
    now = datetime(2026, 3, 12, 16, 0, tzinfo=ZoneInfo("Africa/Lagos"))
    trades = [_t(i, Decimal("1.00"), risk=Decimal("7.00"), day_offset=i) for i in range(5)]
    snap = compute_risk_snapshot(
        starting_balance=START,
        profile=_profile(),
        trades=trades,
        now=now,
        timezone=TZ,
    )
    assert snap.avg_risk_last_n == Decimal("7.00")
    assert snap.status in {RiskStatus.YELLOW, RiskStatus.RED}
    assert any("average risk" in r.lower() for r in snap.reasons)


def test_max_trades_warning() -> None:
    now = datetime(2026, 3, 10, 16, 0, tzinfo=ZoneInfo("Africa/Lagos"))
    trades = [_t(0, Decimal("2.00")), _t(1, Decimal("2.00"))]
    snap = compute_risk_snapshot(
        starting_balance=START,
        profile=_profile(),
        trades=trades,
        now=now,
        timezone=TZ,
    )
    assert snap.trades_today == 2
    assert any("maximum is 2" in r for r in snap.reasons)


def test_consecutive_losses() -> None:
    now = datetime(2026, 3, 15, 16, 0, tzinfo=ZoneInfo("Africa/Lagos"))
    trades = [_t(i, Decimal("-5.00"), day_offset=i) for i in range(5)]
    snap = compute_risk_snapshot(
        starting_balance=START,
        profile=_profile(),
        trades=trades,
        now=now,
        timezone=TZ,
    )
    assert snap.consecutive_losses == 5
    assert snap.status == RiskStatus.RED
