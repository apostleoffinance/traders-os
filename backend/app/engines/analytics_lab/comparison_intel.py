"""Comparison Lab — filter groups and compare metrics."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Callable, Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.statistics import bootstrap_difference, cohens_d, compare_metrics, effect_size_magnitude
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ratio
from app.engines.performance_engine import compute_performance
from app.engines.risk_engine import ClosedTrade, TradeStatus


@dataclass(frozen=True)
class ComparisonGroupSpec:
    label: str = "Group"
    session: str | None = None
    symbol: str | None = None
    direction: str | None = None
    setup_id: str | None = None
    psychology: str | None = None
    timeframe: str | None = None
    min_discipline: int | None = None
    max_discipline: int | None = None
    emotional: bool | None = None  # True = only emotional, False = only non-emotional


def apply_group_filter(rows: Sequence[AnalyticsTrade], spec: ComparisonGroupSpec) -> list[AnalyticsTrade]:
    out: list[AnalyticsTrade] = []
    for t in closed_trades(list(rows)):
        if spec.session and t.session != spec.session:
            continue
        if spec.symbol and t.symbol.upper() != spec.symbol.upper():
            continue
        if spec.direction and t.direction != spec.direction:
            continue
        if spec.setup_id and t.setup_id != spec.setup_id:
            continue
        if spec.psychology and (t.emotion_before or "unknown") != spec.psychology:
            continue
        if spec.timeframe and t.timeframe != spec.timeframe:
            continue
        if spec.min_discipline is not None:
            if t.discipline_score is None or t.discipline_score < spec.min_discipline:
                continue
        if spec.max_discipline is not None:
            if t.discipline_score is None or t.discipline_score > spec.max_discipline:
                continue
        if spec.emotional is True and not t.emotional_trade:
            continue
        if spec.emotional is False and t.emotional_trade:
            continue
        out.append(t)
    return out


def _group_metrics(trades: Sequence[AnalyticsTrade], starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    views = [
        ClosedTrade(
            id=t.id,
            entry_at=t.entry_at,
            exit_at=t.exit_at,
            risk_amount=t.risk_amount,
            realized_pnl=t.net_pnl,
            result=t.result,
            status=TradeStatus.CLOSED,
        )
        for t in closed
    ]
    perf = compute_performance(views, starting)
    rs = [t.r_multiple for t in closed if t.r_multiple is not None]
    holds = [t.holding_time_seconds for t in closed if t.holding_time_seconds is not None]
    discs = [t.discipline_score for t in closed if t.discipline_score is not None]
    return {
        "n": perf.n_trades,
        "win_rate": perf.win_rate,
        "profit_factor": perf.profit_factor,
        "expectancy_r": perf.expectancy_r,
        "average_r": perf.average_r,
        "net_pnl": perf.net_pnl,
        "max_drawdown": perf.max_drawdown,
        "average_discipline": int(sum(discs) / len(discs)) if discs else None,
        "average_hold_seconds": int(sum(holds) / len(holds)) if holds else None,
    }


def build_comparison(
    trades_a: Sequence[AnalyticsTrade],
    trades_b: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    label_a: str = "Group A",
    label_b: str = "Group B",
) -> dict:
    ma = _group_metrics(trades_a, starting)
    mb = _group_metrics(trades_b, starting)
    rs_a = [t.r_multiple for t in closed_trades(list(trades_a)) if t.r_multiple is not None]
    rs_b = [t.r_multiple for t in closed_trades(list(trades_b)) if t.r_multiple is not None]

    d = cohens_d(rs_a, rs_b) if rs_a and rs_b else None
    boot = bootstrap_difference(rs_a, rs_b) if rs_a and rs_b else {"available": False}

    return {
        "group_a": {"label": label_a, **ma, "confidence": confidence_payload(ma["n"], metric=label_a)},
        "group_b": {"label": label_b, **mb, "confidence": confidence_payload(mb["n"], metric=label_b)},
        "comparison": compare_metrics(ma, mb),
        "statistical_notes": {
            "bootstrap_r_difference": boot,
            "effect_size": effect_size_magnitude(d) if d is not None else None,
            "cohens_d": round(d, 4) if d is not None else None,
            "disclaimer": "Small samples limit statistical inference. Differences are descriptive.",
        },
    }


def compare_groups(
    rows: Sequence[AnalyticsTrade],
    spec_a: ComparisonGroupSpec,
    spec_b: ComparisonGroupSpec,
    *,
    starting: Decimal,
) -> dict:
    a = apply_group_filter(rows, spec_a)
    b = apply_group_filter(rows, spec_b)
    result = build_comparison(a, b, starting=starting, label_a=spec_a.label, label_b=spec_b.label)
    result["filters"] = {
        "group_a": _spec_dict(spec_a),
        "group_b": _spec_dict(spec_b),
    }
    return result


def _spec_dict(spec: ComparisonGroupSpec) -> dict:
    return {k: v for k, v in spec.__dict__.items() if v is not None and k != "label"}


def preset_comparisons(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> list[dict]:
    """Built-in comparisons for common questions."""
    closed = closed_trades(list(trades))
    presets = []

    def compare(filter_a: Callable, filter_b: Callable, la: str, lb: str):
        a = [t for t in closed if filter_a(t)]
        b = [t for t in closed if filter_b(t)]
        if a and b:
            presets.append(build_comparison(a, b, starting=starting, label_a=la, label_b=lb))

    compare(lambda t: t.session == "london", lambda t: t.session == "new_york", "London", "New York")
    compare(lambda t: t.direction == "long", lambda t: t.direction == "short", "Long", "Short")
    compare(
        lambda t: t.discipline_score is not None and t.discipline_score >= 85,
        lambda t: t.discipline_score is not None and t.discipline_score < 70,
        "High discipline (85+)",
        "Low discipline (<70)",
    )
    return presets
