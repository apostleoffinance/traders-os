"""Assemble Analytics Lab payload (Phase 1 + Phase 2)."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.consistency import build_consistency_scorecard
from app.engines.analytics_lab.costs import build_costs
from app.engines.analytics_lab.distribution import build_distributions
from app.engines.analytics_lab.edge import build_edge
from app.engines.analytics_lab.equity import build_equity_analytics
from app.engines.analytics_lab.execution import build_execution
from app.engines.analytics_lab.performance import build_performance
from app.engines.analytics_lab.risk_analytics import build_risk_analytics
from app.engines.analytics_lab.sample_rules import with_evidence
from app.engines.analytics_lab.intelligence import build_intelligence_lab
from app.engines.analytics_lab.streaks import build_streaks_analytics
from app.engines.analytics_lab.temporal import build_temporal
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, trade_to_analytics
from app.models.trade import Trade


def build_analytics_lab(
    trades: Sequence[Trade],
    *,
    starting: Decimal,
    timezone: str,
    filters: dict,
    period: str,
    previous_trades: Sequence[Trade] | None = None,
    configured_risk: Decimal | None = None,
) -> dict:
    rows = [trade_to_analytics(t) for t in trades]
    prev_rows = [trade_to_analytics(t) for t in previous_trades] if previous_trades else []
    closed = closed_trades(rows)
    n = len(closed)

    return {
        "metadata": {
            "sample_size": n,
            "period": period,
            "timezone": timezone,
            "filters": filters,
            "evidence": with_evidence(n),
            "definitions": {
                "net_pnl": "Realized economic result (includes commission and swap for MT5 trades).",
                "gross_pnl": "Trading profit before commission and swap: net_pnl - commission - swap.",
                "r_multiple": "net_pnl / risk_amount when risk is known; null when risk is unavailable.",
                "win": "net_pnl > 0",
                "loss": "net_pnl < 0",
                "breakeven": "|net_pnl| ≤ 0.01 — breaks win/loss streaks, excluded from win/loss rates.",
                "drawdown": "equity_t - running_peak(equity); recovery when equity reaches prior peak.",
            },
        },
        "performance": build_performance(rows, starting),
        "edge": build_edge(rows, timezone),
        "execution": build_execution(rows),
        "costs": build_costs(rows),
        "distributions": build_distributions(rows, timezone=timezone),
        "consistency": build_consistency_scorecard(rows, timezone=timezone),
        "equity": build_equity_analytics(rows, starting=starting),
        "streaks": build_streaks_analytics(rows, starting=starting),
        "risk_analytics": build_risk_analytics(rows, starting=starting, configured_risk=configured_risk),
        "temporal": build_temporal(
            rows,
            starting=starting,
            timezone=timezone,
            previous_trades=prev_rows,
        ),
        "intelligence": build_intelligence_lab(
            rows,
            starting=starting,
            configured_risk=configured_risk,
        ),
    }
