"""Historical vs recent performance comparison."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, ratio
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.payoff import build_payoff
from app.engines.quant_lab.sample_policy import sample_payload


def _profit_factor(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    wins = sum((t.net_pnl for t in trades if t.net_pnl > ZERO), ZERO)
    losses = abs(sum((t.net_pnl for t in trades if t.net_pnl < ZERO), ZERO))
    if losses == ZERO:
        return None
    return ratio(wins / losses)


def _metrics(trades: Sequence[AnalyticsTrade]) -> dict:
    exp = build_expectancy(trades)
    pay = build_payoff(trades)
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    return {
        "n": len(trades),
        "expectancy_r": exp["expectancy_r"],
        "expectancy_currency": exp["expectancy_currency"],
        "win_rate": exp["win_rate"],
        "profit_factor": _profit_factor(trades),
        "payoff_ratio_r": pay["payoff_ratio_r"],
        "average_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
    }


def _diff(historical: dict, recent: dict) -> dict:
    out = {}
    for key in ("expectancy_r", "win_rate", "profit_factor", "payoff_ratio_r", "average_r"):
        h, r = historical.get(key), recent.get(key)
        if h is None or r is None:
            out[key] = {"absolute": None, "percentage": None}
            continue
        h_d, r_d = Decimal(str(h)), Decimal(str(r))
        abs_diff = r_d - h_d
        pct = None
        if h_d != ZERO:
            pct = ratio(abs_diff / abs(h_d) * Decimal("100"))
        out[key] = {"absolute": ratio(abs_diff), "percentage": pct}
    return out


def build_edge_stability(
    trades: Sequence[AnalyticsTrade],
    *,
    recent_n: int = 30,
) -> dict:
    ordered = list(trades)
    n = len(ordered)
    recent = ordered[-recent_n:] if n else []
    historical = build_expectancy(ordered)
    recent_metrics = _metrics(recent)
    historical_metrics = _metrics(ordered)
    return {
        "historical": historical_metrics,
        "recent": recent_metrics,
        "recent_window": recent_n,
        "differences": _diff(historical_metrics, recent_metrics),
        "label": "POSSIBLE PERFORMANCE CHANGE",
        "disclaimer": (
            "Recent observations differ from the broader historical sample. "
            "More data may be required to determine whether this reflects normal variation "
            "or a meaningful change."
        ),
        "category": "STATISTICAL_CONFIDENCE",
        "sample": sample_payload(n),
        "recent_sample": sample_payload(len(recent)),
    }
