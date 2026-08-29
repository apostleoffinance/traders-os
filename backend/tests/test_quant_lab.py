"""Quant Lab Phase A & B tests."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.core.enums import TradeResult, TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.quant_lab.bootstrap import bootstrap_expectancy
from app.engines.quant_lab.builder import build_quant_lab
from app.engines.quant_lab.confidence import wilson_ci
from app.engines.quant_lab.data_quality import validate_quant_trades
from app.engines.quant_lab.drawdown import build_drawdown
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.payoff import build_payoff
from app.engines.quant_lab.recovery import recovery_factor
from app.engines.quant_lab.rolling import build_rolling
from app.engines.quant_lab.sample_policy import EvidenceLevel, classify_sample
from app.engines.quant_lab.distribution import build_distribution
from app.engines.quant_lab.outliers import build_outlier_dependency
from app.engines.quant_lab.robustness import build_bootstrap_robustness, build_top_trade_removal
from app.engines.quant_lab.ulcer import ulcer_index_r


def _row(
    *,
    pnl: Decimal,
    risk: Decimal = Decimal("10"),
    exit_day: int = 1,
    trade_id: str | None = None,
    exit_at: datetime | None = None,
) -> AnalyticsTrade:
    entry = datetime(2026, 3, exit_day, 9, 0, tzinfo=timezone.utc)
    exit_dt = exit_at or datetime(2026, 3, exit_day, 10, 0, tzinfo=timezone.utc)
    tid = trade_id or f"t-{exit_day}-{pnl}"
    return AnalyticsTrade(
        id=tid,
        symbol="EURUSD",
        direction="long",
        session="london",
        setup="sweep",
        setup_id=None,
        timeframe="M15",
        entry_at=entry,
        exit_at=exit_dt,
        entry_price=Decimal("1.1"),
        exit_price=Decimal("1.11"),
        lot_size=Decimal("0.1"),
        risk_amount=risk,
        risk_percent=Decimal("1"),
        commission=Decimal("0"),
        swap=Decimal("0"),
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


def test_sample_policy_thresholds() -> None:
    assert classify_sample(5) == EvidenceLevel.INSUFFICIENT
    assert classify_sample(15) == EvidenceLevel.EXPLORATORY
    assert classify_sample(42) == EvidenceLevel.MODERATE
    assert classify_sample(120) == EvidenceLevel.STRONGER
    assert classify_sample(300) == EvidenceLevel.HIGHER_EVIDENCE


def test_data_quality_excludes_missing_exit() -> None:
    bad = AnalyticsTrade(
        id="bad",
        symbol="EURUSD",
        direction="long",
        session="london",
        setup="sweep",
        setup_id=None,
        timeframe="M15",
        entry_at=datetime(2026, 3, 1, 9, 0, tzinfo=timezone.utc),
        exit_at=None,
        entry_price=Decimal("1.1"),
        exit_price=None,
        lot_size=Decimal("0.1"),
        risk_amount=Decimal("10"),
        risk_percent=Decimal("1"),
        commission=Decimal("0"),
        swap=Decimal("0"),
        realized_pnl=Decimal("10"),
        realized_r=Decimal("1"),
        holding_time_seconds=None,
        mfe_price=None,
        mae_price=None,
        mfe_r=None,
        mae_r=None,
        mfe_mae_source=None,
        result=TradeResult.WIN,
        status=TradeStatus.CLOSED,
        emotion_before=None,
    )
    report = validate_quant_trades([bad, _row(pnl=Decimal("5"))])
    assert report["valid_quant_trades"] == 1
    assert report["excluded_trades"] == 1


def test_expectancy_decomposition() -> None:
    trades = [_row(pnl=Decimal("20")), _row(pnl=Decimal("-10"), exit_day=2), _row(pnl=Decimal("5"), exit_day=3)]
    exp = build_expectancy(trades)
    assert exp["wins"] == 2
    assert exp["losses"] == 1
    assert Decimal(exp["expectancy_r"]) == Decimal("0.50")


def test_payoff_no_losses() -> None:
    trades = [_row(pnl=Decimal("10")), _row(pnl=Decimal("20"), exit_day=2)]
    pay = build_payoff(trades)
    assert pay["payoff_ratio_currency"] is None
    assert pay["note"] is not None


def test_wilson_ci_bounds() -> None:
    ci = wilson_ci(5, 10)
    assert ci["available"] is True
    assert Decimal(ci["lower_bound"]) < Decimal(ci["observed"]) < Decimal(ci["upper_bound"])


def test_rolling_null_until_window_full() -> None:
    trades = [_row(pnl=Decimal("10"), exit_day=i + 1) for i in range(5)]
    roll = build_rolling(trades, windows=(3,))
    series = roll["series"]["3"]
    assert series[0]["expectancy_r"] is None
    assert series[2]["expectancy_r"] is not None


def test_drawdown_r_curve() -> None:
    trades = [
        _row(pnl=Decimal("10"), exit_day=1),
        _row(pnl=Decimal("-20"), exit_day=2),
        _row(pnl=Decimal("30"), exit_day=3),
    ]
    dd = build_drawdown(trades, starting=Decimal("1000"))
    assert dd["r_multiple"]["max_drawdown_r"] is not None


def test_recovery_factor_zero_drawdown() -> None:
    rec = recovery_factor(Decimal("100"), Decimal("0"))
    assert rec["available"] is False


def test_bootstrap_reproducible() -> None:
    values = [Decimal("1"), Decimal("-0.5"), Decimal("2"), Decimal("-1"), Decimal("0.5")]
    a = bootstrap_expectancy(values, iterations=500, seed=99)
    b = bootstrap_expectancy(values, iterations=500, seed=99)
    assert a["median"] == b["median"]
    assert a["confidence_interval"] == b["confidence_interval"]
    assert a.get("histogram")
    assert len(a["histogram"]) > 0


def test_builder_overview_sections() -> None:
    trades = [_row(pnl=Decimal("10"), exit_day=i + 1) for i in range(12)]
    lab = build_quant_lab(trades, starting=Decimal("1000"))
    assert "overview" in lab
    assert "edge" in lab
    assert "drawdown" in lab
    assert lab["overview"]["data_quality"]["valid_quant_trades"] == 12


def test_ulcer_index_r() -> None:
    curve = [
        {"drawdown_r": Decimal("0")},
        {"drawdown_r": Decimal("2")},
        {"drawdown_r": Decimal("1")},
        {"drawdown_r": Decimal("0")},
    ]
    ui = ulcer_index_r(curve)
    assert ui["available"] is True
    assert ui["ulcer_index_r"] is not None


def test_distribution_skewness() -> None:
    trades = [
        _row(pnl=Decimal("50"), exit_day=1),
        _row(pnl=Decimal("10"), exit_day=2),
        _row(pnl=Decimal("5"), exit_day=3),
        _row(pnl=Decimal("-10"), exit_day=4),
        _row(pnl=Decimal("-10"), exit_day=5),
    ]
    dist = build_distribution(trades)
    assert dist["r_multiple"]["n"] == 5
    assert dist["r_multiple"]["advanced"]["skewness"] is not None


def test_outlier_dependency_high() -> None:
    trades = [_row(pnl=Decimal("100"), exit_day=1)] + [_row(pnl=Decimal("5"), exit_day=i + 2) for i in range(9)]
    out = build_outlier_dependency(trades)
    assert out["dependency_level"] == "HIGH"
    assert out["profit_dependency_top_5_pct"] is not None


def test_top_trade_removal_scenarios() -> None:
    trades = [_row(pnl=Decimal("100"), exit_day=1)] + [_row(pnl=Decimal("-10"), exit_day=i + 2) for i in range(5)]
    rob = build_top_trade_removal(trades)
    assert len(rob["scenarios"]) == 4
    all_pf = rob["scenarios"][0]["profit_factor"]
    without_pf = rob["scenarios"][1]["profit_factor"]
    assert all_pf is not None
    assert without_pf is not None
    assert Decimal(without_pf) < Decimal(all_pf)


def test_bootstrap_robustness_reproducible() -> None:
    trades = [_row(pnl=Decimal("10"), exit_day=i + 1) for i in range(15)]
    a = build_bootstrap_robustness(trades, iterations=400, seed=7)
    b = build_bootstrap_robustness(trades, iterations=400, seed=7)
    assert a["expectancy_r"]["bootstrap_median"] == b["expectancy_r"]["bootstrap_median"]


def test_builder_includes_phase_c() -> None:
    trades = [_row(pnl=Decimal("20"), exit_day=i + 1) for i in range(8)]
    lab = build_quant_lab(trades, starting=Decimal("1000"))
    assert "distribution" in lab
    assert "outliers" in lab
    assert "robustness" in lab
    assert lab["overview"]["edge_status"]["outlier_dependency_level"] is not None
