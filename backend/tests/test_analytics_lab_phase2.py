"""Analytics Lab Phase 2 — distributions, equity, streaks, temporal."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.builder import build_analytics_lab
from app.engines.analytics_lab.distribution import build_distributions
from app.engines.analytics_lab.equity import build_equity_analytics
from app.engines.analytics_lab.streaks import build_streaks_analytics
from app.engines.analytics_lab.trade_row import AnalyticsTrade


def _row(
    *,
    pnl: Decimal,
    risk: Decimal = Decimal("10"),
    commission: Decimal = Decimal("0"),
    swap: Decimal = Decimal("0"),
    exit_day: int = 1,
    exit_hour: int = 10,
    risk_percent: Decimal = Decimal("1"),
) -> AnalyticsTrade:
    entry = datetime(2026, 3, exit_day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 3, exit_day, exit_hour, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{exit_day}-{exit_hour}-{pnl}",
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
        risk_amount=risk,
        risk_percent=risk_percent,
        commission=commission,
        swap=swap,
        realized_pnl=pnl,
        realized_r=pnl / risk if risk > 0 else None,
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS if pnl < 0 else TradeResult.BREAKEVEN,
        status=TradeStatus.CLOSED,
        emotion_before=None,
    )


def test_expectancy_mixed_with_breakeven() -> None:
    trades = [
        _row(pnl=Decimal("20")),
        _row(pnl=Decimal("-10")),
        _row(pnl=Decimal("0")),
        _row(pnl=Decimal("5")),
    ]
    exp = build_distributions(trades, timezone="UTC")["expectancy"]
    assert exp["n"] == 4
    assert exp["breakevens"] == 1
    assert exp["expectancy_currency"] is not None
    assert Decimal(exp["expectancy_r"]) == Decimal("0.38")


def test_expectancy_all_wins() -> None:
    trades = [_row(pnl=Decimal("10")), _row(pnl=Decimal("20"))]
    exp = build_distributions(trades, timezone="UTC")["expectancy"]
    assert Decimal(exp["win_rate"]) == Decimal("100.00")
    assert Decimal(exp["expectancy_currency"]) == Decimal("15.00")


def test_drawdown_sequence() -> None:
    # Equity path: 1000 -> 1200 -> 1100 -> 900 -> 1300 (net +200, +100, -200, +400)
    starting = Decimal("1000")
    trades = [
        _row(pnl=Decimal("200"), exit_day=1),
        _row(pnl=Decimal("-100"), exit_day=2),
        _row(pnl=Decimal("-200"), exit_day=3),
        _row(pnl=Decimal("400"), exit_day=4),
    ]
    eq = build_equity_analytics(trades, starting=starting)
    dd = eq["drawdown"]
    assert Decimal(dd["max_drawdown"]) == Decimal("300.00")
    recovered = [e for e in dd["episodes"]["episodes"] if e["recovered"]]
    assert len(recovered) >= 1
    assert len(eq["markers"]) == 4
    assert eq["markers"][0]["trade_id"] == "t-1-10-200"


def test_streaks_wwlllwwl() -> None:
    pnls = [Decimal("10"), Decimal("10"), Decimal("-10"), Decimal("-10"), Decimal("-10"), Decimal("10"), Decimal("10"), Decimal("-10")]
    trades = [_row(pnl=p, exit_day=i + 1) for i, p in enumerate(pnls)]
    s = build_streaks_analytics(trades, starting=Decimal("1000"))
    assert s["longest"]["wins"] == 2
    assert s["longest"]["losses"] == 3


def test_streak_breakeven_breaks() -> None:
    trades = [
        _row(pnl=Decimal("10"), exit_day=1),
        _row(pnl=Decimal("10"), exit_day=2),
        _row(pnl=Decimal("0"), exit_day=3),
        _row(pnl=Decimal("10"), exit_day=4),
    ]
    s = build_streaks_analytics(trades, starting=Decimal("1000"))
    assert s["longest"]["wins"] == 2


def test_builder_includes_phase2_sections() -> None:
    from types import SimpleNamespace

    trade = SimpleNamespace(
        id="x",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup=SimpleNamespace(name="sweep"),
        setup_id=None,
        timeframe="M15",
        trade_timestamp=datetime(2026, 3, 1, 9, tzinfo=timezone.utc),
        exit_timestamp=datetime(2026, 3, 1, 10, tzinfo=timezone.utc),
        entry_price="1.1",
        exit_price="1.11",
        lot_size="0.1",
        risk_amount="10",
        risk_percent="1",
        commission="0",
        swap="0",
        realized_pnl="10",
        realized_r="1",
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN,
        status=TradeStatus.CLOSED,
        psychology=None,
    )
    lab = build_analytics_lab([trade], starting=Decimal("1000"), timezone="UTC", filters={}, period="all")
    for key in ("distributions", "consistency", "equity", "streaks", "risk_analytics", "temporal"):
        assert key in lab
