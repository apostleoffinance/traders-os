from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.enums import TradeResult, TradeStatus
from app.engines.performance_engine import compute_performance
from app.engines.risk_engine import ClosedTrade


def _t(i: int, pnl: Decimal, risk: Decimal = Decimal("5")) -> ClosedTrade:
    ts = datetime(2026, 3, 1, 10, 0, tzinfo=ZoneInfo("UTC")) + timedelta(days=i)
    return ClosedTrade(
        id=str(i),
        entry_at=ts,
        exit_at=ts + timedelta(hours=1),
        risk_amount=risk,
        realized_pnl=pnl,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
    )


def test_expectancy_is_average_r() -> None:
    trades = [
        _t(0, Decimal("10")),  # +2R
        _t(1, Decimal("-5")),  # -1R
        _t(2, Decimal("5")),  # +1R
    ]
    m = compute_performance(trades, Decimal("1000"))
    assert m.expectancy_r == Decimal("0.67")  # (2-1+1)/3 = 0.666… → 0.67
    assert m.n_trades == 3
    assert m.win_rate == Decimal("66.67")
    assert m.profit_factor == Decimal("3.00")  # 15 / 5
    assert m.sharpe is None
    assert "fewer than 30" in (m.sharpe_note.reason or "")


def test_profit_factor_undefined_without_losses() -> None:
    trades = [_t(0, Decimal("5")), _t(1, Decimal("5"))]
    m = compute_performance(trades, Decimal("1000"))
    assert m.profit_factor is None
