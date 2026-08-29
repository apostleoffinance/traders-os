"""Personal Edge Map & Weakness Map."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import classify_confidence, ConfidenceLevel
from app.engines.analytics_lab.playbook_intel import _edge_quality_score
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ZERO


def _combo_key(t: AnalyticsTrade) -> str:
    return f"{t.symbol}|{t.session}|{t.setup}|{t.direction}|{t.timeframe}"


def build_edge_maps(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    combos: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in closed:
        combos[_combo_key(t)].append(t)

    ranked = []
    for key, items in combos.items():
        parts = key.split("|")
        row = dump_perf_group(key, journal_rows(items), starting, "Combo")
        rs = [t.r_multiple for t in items if t.r_multiple is not None]
        eq = _edge_quality_score(
            expectancy_r=Decimal(str(row["expectancy_r"])) if row.get("expectancy_r") else None,
            n=row["n"],
            rs=rs,
            max_dd_r=None,
            recent_exp=None,
            hist_exp=None,
        )
        ranked.append(
            {
                "symbol": parts[0],
                "session": parts[1],
                "setup": parts[2],
                "direction": parts[3],
                "timeframe": parts[4],
                "n": row["n"],
                "expectancy_r": row["expectancy_r"],
                "win_rate": row["win_rate"],
                "profit_factor": row["profit_factor"],
                "edge_quality": eq,
                "evidence": row["evidence"],
            }
        )

    ranked.sort(key=lambda x: -float(x["edge_quality"]["score"] or 0))
    edges = [r for r in ranked if r.get("expectancy_r") and float(r["expectancy_r"]) > 0 and classify_confidence(r["n"]) != ConfidenceLevel.INSUFFICIENT]
    weaknesses = sorted(
        [r for r in ranked if r.get("expectancy_r") and float(r["expectancy_r"]) < 0 and r["n"] >= 3],
        key=lambda x: float(x["expectancy_r"]),
    )

    return {
        "combinations": ranked[:48],
        "edge_map": edges[:12],
        "weakness_map": weaknesses[:12],
        "methodology": {
            "edge_quality": "Transparent score: expectancy + sample + consistency + drawdown + stability",
            "minimum_n_for_edge": 5,
            "disclaimer": "Rankings require adequate sample size. Highest return alone does not define edge quality.",
        },
        "sample_size": len(closed),
    }
