"""Analytics Lab Phase 1 — quantitative calculations."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.costs import build_costs
from app.engines.analytics_lab.execution import build_execution
from app.engines.analytics_lab.performance import build_performance
from app.engines.analytics_lab.trade_row import AnalyticsTrade, trade_to_analytics


def _row(
    *,
    pnl: Decimal,
    risk: Decimal = Decimal("10"),
    direction: str = "long",
    commission: Decimal = Decimal("0"),
    swap: Decimal = Decimal("0"),
    symbol: str = "EURUSD",
    session: str = "london",
    setup: str = "sweep",
    holding: int = 600,
    hour: int = 9,
    mfe_r: Decimal | None = None,
    mae_r: Decimal | None = None,
    mfe_mae_source: str | None = None,
) -> AnalyticsTrade:
    entry = datetime(2026, 3, 1, hour, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 3, 1, hour, 10, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"{symbol}-{hour}-{pnl}",
        symbol=symbol,
        direction=direction,
        session=session,
        setup=setup,
        setup_id=None,
        timeframe="M15",
        entry_at=entry,
        exit_at=exit_at,
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.11"),
        lot_size=Decimal("0.1"),
        risk_amount=risk,
        risk_percent=Decimal("1"),
        commission=commission,
        swap=swap,
        realized_pnl=pnl,
        realized_r=pnl / risk if risk > 0 else None,
        holding_time_seconds=holding,
        mfe_price=None,
        mae_price=None,
        mfe_r=mfe_r,
        mae_r=mae_r,
        mfe_mae_source=mfe_mae_source,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS if pnl < 0 else TradeResult.BREAKEVEN,
        status=TradeStatus.CLOSED,
        emotion_before=None,
    )


def test_win_rate_mixed() -> None:
    trades = [_row(pnl=Decimal("20")), _row(pnl=Decimal("-10")), _row(pnl=Decimal("5"))]
    perf = build_performance(trades, Decimal("1000"))
    wl = perf["win_loss"]
    assert wl["n"] == 3
    assert wl["wins"] == 2
    assert wl["losses"] == 1
    assert Decimal(wl["win_rate"]) == Decimal("66.67")


def test_win_rate_all_wins() -> None:
    trades = [_row(pnl=Decimal("10")), _row(pnl=Decimal("5"))]
    wl = build_performance(trades, Decimal("1000"))["win_loss"]
    assert Decimal(wl["win_rate"]) == Decimal("100.00")
    assert wl["losses"] == 0


def test_win_rate_zero_trades() -> None:
    wl = build_performance([], Decimal("1000"))["win_loss"]
    assert wl["n"] == 0
    assert wl["win_rate"] is None


def test_profit_factor_normal() -> None:
    trades = [_row(pnl=Decimal("30")), _row(pnl=Decimal("-10"))]
    pf = build_performance(trades, Decimal("1000"))["win_loss"]["profit_factor"]
    assert Decimal(pf["value"]) == Decimal("3.00")


def test_profit_factor_no_losses() -> None:
    trades = [_row(pnl=Decimal("10"))]
    pf = build_performance(trades, Decimal("1000"))["win_loss"]["profit_factor"]
    assert pf["value"] is None
    assert "no losing trades" in (pf["note"] or "").lower()


def test_net_pnl_mt5_sign_convention() -> None:
    # MT5: net = gross + commission + swap (commission/swap typically negative)
    gross = Decimal("100")
    commission = Decimal("-2")
    swap = Decimal("-1")
    net = gross + commission + swap
    t = _row(pnl=net, commission=commission, swap=swap)
    assert t.gross_pnl == gross
    assert t.net_pnl == net
    costs = build_costs([t])
    assert Decimal(costs["gross_vs_net"]["gross_pnl"]) == gross
    assert Decimal(costs["gross_vs_net"]["net_pnl"]) == net


def test_long_short_comparison() -> None:
    trades = [
        _row(pnl=Decimal("20"), direction="long"),
        _row(pnl=Decimal("-5"), direction="long"),
        _row(pnl=Decimal("-15"), direction="short"),
    ]
    dc = build_performance(trades, Decimal("1000"))["direction_comparison"]
    assert dc["long"]["n"] == 2
    assert dc["short"]["n"] == 1
    assert Decimal(dc["long"]["net_pnl"]) == Decimal("15.00")
    assert Decimal(dc["short"]["net_pnl"]) == Decimal("-15.00")


def test_duration_buckets() -> None:
    trades = [
        _row(pnl=Decimal("5"), holding=120),
        _row(pnl=Decimal("-5"), holding=3600),
    ]
    ex = build_execution(trades)
    buckets = {b["bucket"]: b["n"] for b in ex["duration"]["buckets"]}
    assert buckets["Under 5m"] == 1
    assert buckets["1–4h"] == 1


def test_mfe_unavailable_without_data() -> None:
    ex = build_execution([_row(pnl=Decimal("10"))])
    assert ex["mfe_mae"]["available"] is False


def test_mfe_available_with_data() -> None:
    trades = [
        _row(pnl=Decimal("20"), mfe_r=Decimal("1.5"), mae_r=Decimal("0.4"), mfe_mae_source="mt5_m1"),
        _row(pnl=Decimal("-10"), mfe_r=Decimal("0.3"), mae_r=Decimal("1.2"), mfe_mae_source="mt5_m1"),
    ]
    ex = build_execution(trades)
    assert ex["mfe_mae"]["available"] is True
    assert ex["mfe_mae"]["coverage_n"] == 2
    assert ex["exit_efficiency"]["available"] is True


def test_exit_efficiency_capture() -> None:
    trades = [_row(pnl=Decimal("15"), mfe_r=Decimal("2.0"), mae_r=Decimal("0.5"), mfe_mae_source="mt5_m1")]
    ex = build_execution(trades)
    assert ex["exit_efficiency"]["median_capture"] is not None


def test_trade_to_analytics_from_model() -> None:
    trade = SimpleNamespace(
        id="abc",
        symbol="XAUUSD",
        direction="short",
        session="new_york",
        setup=None,
        setup_id=None,
        timeframe="H1",
        trade_timestamp=datetime(2026, 3, 1, 14, 0, tzinfo=timezone.utc),
        exit_timestamp=datetime(2026, 3, 1, 16, 0, tzinfo=timezone.utc),
        entry_price=Decimal("2000"),
        exit_price=Decimal("1995"),
        lot_size=Decimal("0.01"),
        risk_amount=Decimal("50"),
        risk_percent=Decimal("0.5"),
        commission=Decimal("-1.5"),
        swap=Decimal("0.5"),
        realized_pnl=Decimal("48"),
        realized_r=Decimal("0.96"),
        holding_time_seconds=7200,
        result=TradeResult.WIN.value,
        status=TradeStatus.CLOSED.value,
        psychology=None,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
    )
    row = trade_to_analytics(trade)  # type: ignore[arg-type]
    assert row.setup == "unclassified"
    assert row.gross_pnl == Decimal("49.00")
