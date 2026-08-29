"""Quant Lab Phase D — Monte Carlo and risk of ruin tests."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.monte_carlo import run_monte_carlo
from app.engines.quant_lab.risk_of_ruin import estimate_risk_of_ruin


def _row(pnl: Decimal, *, day: int = 1) -> AnalyticsTrade:
    entry = datetime(2026, 3, day, 9, 0, tzinfo=timezone.utc)
    exit_at = datetime(2026, 3, day, 10, 0, tzinfo=timezone.utc)
    return AnalyticsTrade(
        id=f"t-{day}-{pnl}",
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
        holding_time_seconds=600,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN if pnl > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        emotion_before=None,
    )


def test_monte_carlo_reproducible() -> None:
    rs = [Decimal("1"), Decimal("-0.5"), Decimal("2"), Decimal("-1"), Decimal("0.5"), Decimal("1"), Decimal("-0.5")]
    a = run_monte_carlo(rs, simulations=500, future_trades=50, seed=99)
    b = run_monte_carlo(rs, simulations=500, future_trades=50, seed=99)
    assert a["available"] is True
    assert a["ending_return"]["median"] == b["ending_return"]["median"]
    assert a["max_drawdown"]["median"] == b["max_drawdown"]["median"]


def test_monte_carlo_insufficient_sample() -> None:
    rs = [Decimal("1"), Decimal("-0.5")]
    out = run_monte_carlo(rs, simulations=100, future_trades=10)
    assert out["available"] is False


def test_monte_carlo_drawdown_at_risk() -> None:
    rs = [Decimal("1"), Decimal("-0.5"), Decimal("2"), Decimal("-1"), Decimal("0.5"), Decimal("1")]
    out = run_monte_carlo(rs, simulations=800, future_trades=30, seed=7, drawdown_threshold=Decimal("5"))
    assert out["drawdown_at_risk"]["p50"] is not None
    assert out["drawdown_at_risk"]["p95"] is not None
    assert out["probabilities"]["exceeding_drawdown_threshold"] is not None


def test_monte_carlo_all_losers_low_positive_prob() -> None:
    rs = [Decimal("-1")] * 10
    out = run_monte_carlo(rs, simulations=200, future_trades=20, seed=1)
    assert out["available"] is True
    assert Decimal(out["probabilities"]["positive_ending_return"]) == Decimal("0.00")


def test_risk_of_ruin_reproducible() -> None:
    rs = [Decimal("1"), Decimal("-1"), Decimal("0.5"), Decimal("-0.5"), Decimal("1"), Decimal("-1")]
    a = estimate_risk_of_ruin(
        rs,
        account_equity=Decimal("10000"),
        risk_per_trade_pct=Decimal("1"),
        ruin_drawdown_pct=Decimal("20"),
        simulations=400,
        seed=11,
    )
    b = estimate_risk_of_ruin(
        rs,
        account_equity=Decimal("10000"),
        risk_per_trade_pct=Decimal("1"),
        ruin_drawdown_pct=Decimal("20"),
        simulations=400,
        seed=11,
    )
    assert a["available"] is True
    assert a["estimated_probability_pct"] == b["estimated_probability_pct"]


def test_risk_of_ruin_requires_equity() -> None:
    rs = [Decimal("1"), Decimal("-1"), Decimal("0.5"), Decimal("-0.5"), Decimal("1")]
    out = estimate_risk_of_ruin(
        rs,
        account_equity=Decimal("0"),
        risk_per_trade_pct=Decimal("1"),
    )
    assert out["available"] is False


def test_builder_includes_simulation_preview() -> None:
    from app.engines.quant_lab.builder import build_quant_lab

    trades = [_row(Decimal("10"), day=i + 1) for i in range(12)]
    lab = build_quant_lab(trades, starting=Decimal("10000"))
    assert lab["simulation"]["status"] == "AWAITING_RUN"
    assert lab["simulation"]["can_run"] is True
