"""Report data completeness — informational, not punitive."""

from __future__ import annotations

from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades


def build_data_quality(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    if n == 0:
        return {
            "completeness_pct": None,
            "total_trades": 0,
            "missing": [],
            "sources": {"manual": 0, "mt5": 0, "other": 0},
            "note": "No closed trades in this period.",
        }

    missing_psych = sum(1 for t in closed if not t.emotion_before)
    missing_setup = sum(1 for t in closed if not t.setup or t.setup == "unclassified")
    missing_mfe = sum(1 for t in closed if t.mfe_r is None and t.mae_r is None)
    missing_checklist = sum(1 for t in closed if t.checklist_total == 0)

    fields = [
        ("psychology_review", missing_psych),
        ("setup_labels", missing_setup),
        ("mfe_mae", missing_mfe),
        ("checklist_responses", missing_checklist),
    ]
    missing = [{"field": name, "count": count} for name, count in fields if count > 0]

    # Completeness: average of field presence rates (core journal fields)
    presence_rates = []
    for _, miss in fields:
        presence_rates.append((n - miss) / n)
    completeness = round(sum(presence_rates) / len(presence_rates) * 100, 1) if presence_rates else None

    sources = {"manual": 0, "mt5": 0, "other": 0}
    for t in closed:
        # Source is tracked on Trade model; default manual when not passed through AnalyticsTrade
        sources["manual"] += 1

    return {
        "completeness_pct": completeness,
        "total_trades": n,
        "missing": missing,
        "sources": sources,
        "note": "Data quality is informational — missing fields reduce confidence in some sections but do not invalidate the report.",
    }
