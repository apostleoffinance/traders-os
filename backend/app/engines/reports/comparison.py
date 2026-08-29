"""Period-over-period comparison for quarterly and yearly reports."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.engines.fx_math import ZERO, ratio


def _dec(val: Any) -> Decimal | None:
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except Exception:
        return None


def _change(current: Decimal | None, previous: Decimal | None) -> dict:
    if current is None or previous is None:
        return {"current": str(current) if current is not None else None, "previous": str(previous) if previous is not None else None, "absolute": None, "pct": None, "direction": None}
    abs_ch = current - previous
    pct = None
    if previous != ZERO:
        pct = ratio(abs_ch / abs(previous) * 100)
    direction = "flat"
    if abs_ch > ZERO:
        direction = "up"
    elif abs_ch < ZERO:
        direction = "down"
    return {
        "current": str(current),
        "previous": str(previous),
        "absolute": str(abs_ch),
        "pct": pct,
        "direction": direction,
    }


def _metric_benefit(metric: str, direction: str) -> str | None:
    """Whether up/down is beneficial for this metric."""
    lower_is_better = {"max_drawdown", "max_drawdown_pct", "risk_violations", "emotional_trades", "consecutive_losses"}
    if direction == "flat":
        return "neutral"
    if metric in lower_is_better:
        return "positive" if direction == "down" else "negative"
    return "positive" if direction == "up" else "negative"


def build_period_comparison(current: dict, previous: dict) -> dict:
    """Compare summary metrics between two lab performance blocks."""
    cur_kpis = current.get("kpis", {})
    prev_kpis = previous.get("kpis", {})
    cur_wl = current.get("win_loss", {})
    prev_wl = previous.get("win_loss", {})

    metrics = {
        "net_pnl": (_dec(cur_kpis.get("net_pnl", {}).get("value")), _dec(prev_kpis.get("net_pnl", {}).get("value"))),
        "expectancy_r": (_dec(cur_kpis.get("expectancy_r", {}).get("value")), _dec(prev_kpis.get("expectancy_r", {}).get("value"))),
        "profit_factor": (_dec(cur_kpis.get("profit_factor", {}).get("value")), _dec(prev_kpis.get("profit_factor", {}).get("value"))),
        "win_rate": (_dec(cur_wl.get("win_rate")), _dec(prev_wl.get("win_rate"))),
        "average_r": (_dec(cur_kpis.get("average_r", {}).get("value")), _dec(prev_kpis.get("average_r", {}).get("value"))),
        "trades": (Decimal(str(cur_wl.get("n", 0))), Decimal(str(prev_wl.get("n", 0)))),
    }

    rows = []
    for name, (c, p) in metrics.items():
        ch = _change(c, p)
        ch["metric"] = name.replace("_", " ").title()
        ch["benefit"] = _metric_benefit(name, ch["direction"] or "flat") if ch["direction"] else None
        rows.append(ch)

    return {
        "available": previous.get("win_loss", {}).get("n", 0) > 0,
        "rows": rows,
        "disclaimer": "Period comparisons are descriptive. Short samples can flip direction with a few trades.",
    }
