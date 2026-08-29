"""Improvement timeline — process vs performance."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.discipline_engine import aggregate_discipline
from app.engines.fx_math import ratio
from app.engines.performance_engine import compute_performance
from app.engines.risk_engine import ClosedTrade, TradeStatus


def _window_metrics(trades: Sequence[AnalyticsTrade], starting: Decimal) -> dict:
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
        for t in trades
    ]
    perf = compute_performance(views, starting)
    disc = [t.discipline_score for t in trades if t.discipline_score is not None]
    checklist_rate = None
    with_cl = [t for t in trades if t.checklist_total > 0]
    if with_cl:
        complete = sum(1 for t in with_cl if t.checklist_checked >= t.checklist_total)
        checklist_rate = ratio(Decimal(complete) / Decimal(len(with_cl)) * Decimal("100"))
    risks = [t.risk_amount for t in trades if t.risk_amount > 0]
    risk_std = None
    if len(risks) >= 2:
        from statistics import pstdev
        risk_std = ratio(Decimal(str(pstdev([float(r) for r in risks]))))
    return {
        "n": perf.n_trades,
        "expectancy_r": perf.expectancy_r,
        "win_rate": perf.win_rate,
        "net_pnl": perf.net_pnl,
        "max_drawdown": perf.max_drawdown,
        "discipline_avg": aggregate_discipline(disc) if disc else None,
        "checklist_completion_pct": checklist_rate,
        "risk_consistency_stdev": risk_std,
    }


def build_improvement_timeline(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    window: int = 20,
) -> dict:
    ordered = ordered_closed(trades)
    n = len(ordered)
    if n < window * 2:
        return {
            "available": False,
            "message": f"Need at least {window * 2} closed trades for window comparison.",
            "confidence": confidence_payload(n),
        }
    current = ordered[-window:]
    previous = ordered[-window * 2 : -window]
    cur = _window_metrics(current, starting)
    prev = _window_metrics(previous, starting)

    def pct_change(cur_val, prev_val) -> str | None:
        if cur_val is None or prev_val is None:
            return None
        try:
            p, c = Decimal(str(prev_val)), Decimal(str(cur_val))
            if p == 0:
                return None
            return ratio((c - p) / abs(p) * Decimal("100"))
        except Exception:
            return None

    process_metrics = ["discipline_avg", "checklist_completion_pct"]
    perf_metrics = ["expectancy_r", "net_pnl", "win_rate"]

    return {
        "available": True,
        "window": window,
        "current": cur,
        "previous": prev,
        "process_change": {m: pct_change(cur.get(m), prev.get(m)) for m in process_metrics},
        "performance_change": {m: pct_change(cur.get(m), prev.get(m)) for m in perf_metrics},
        "interpretation_note": "Process and performance can diverge in short windows. Improved process may precede improved outcomes.",
        "confidence": confidence_payload(n, metric="Improvement timeline"),
    }
