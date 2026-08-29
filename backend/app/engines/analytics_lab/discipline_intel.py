"""Discipline & checklist intelligence."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.checklist_intel import build_checklist_item_analytics
from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import money, ratio

DISCIPLINE_BUCKETS = [
    ("0–49", 0, 49),
    ("50–69", 50, 69),
    ("70–84", 70, 84),
    ("85–100", 85, 100),
]

RISK_CATEGORIES = [
    ("WITHIN_PLAN", Decimal("0"), Decimal("1.10")),
    ("SLIGHT_DEVIATION", Decimal("1.10"), Decimal("1.25")),
    ("SIGNIFICANT_DEVIATION", Decimal("1.25"), Decimal("1.50")),
    ("POLICY_VIOLATION", Decimal("1.50"), None),
]


def _discipline_buckets(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> list[dict]:
    rows = []
    for label, lo, hi in DISCIPLINE_BUCKETS:
        items = [t for t in closed_trades(list(trades)) if t.discipline_score is not None and lo <= t.discipline_score <= hi]
        row = dump_perf_group(label, journal_rows(items), starting, "Discipline")
        rows.append(
            {
                "bucket": label,
                "n": row["n"],
                "win_rate": row["win_rate"],
                "expectancy_r": row["expectancy_r"],
                "average_r": row["average_r"],
                "net_pnl": row["net_pnl"],
                "evidence": row["evidence"],
            }
        )
    return rows


def _risk_adherence(trades: Sequence[AnalyticsTrade], *, configured_risk: Decimal | None) -> list[dict]:
    if not configured_risk or configured_risk <= 0:
        return []
    counts: dict[str, int] = {c[0]: 0 for c in RISK_CATEGORIES}
    for t in closed_trades(list(trades)):
        if t.risk_amount <= 0:
            continue
        ratio_val = t.risk_amount / configured_risk
        for label, lo, hi in RISK_CATEGORIES:
            if ratio_val >= lo and (hi is None or ratio_val < hi):
                counts[label] += 1
                break
    return [{"category": k, "n": v} for k, v in counts.items()]


def build_discipline_intelligence(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    configured_risk: Decimal | None,
) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    with_disc = [t for t in closed if t.discipline_score is not None]
    with_checklist = [t for t in closed if t.checklist_total > 0]

    complete = [t for t in with_checklist if t.checklist_checked >= t.checklist_total]
    incomplete = [t for t in with_checklist if t.checklist_checked < t.checklist_total]

    complete_row = dump_perf_group("complete", journal_rows(complete), starting, "Checklist complete")
    incomplete_row = dump_perf_group("incomplete", journal_rows(incomplete), starting, "Checklist incomplete")

    high_disc = [t for t in closed if t.discipline_score is not None and t.discipline_score >= 85]
    low_disc = [t for t in closed if t.discipline_score is not None and t.discipline_score < 70]
    high_row = dump_perf_group("high", journal_rows(high_disc), starting, "High discipline")
    low_row = dump_perf_group("low", journal_rows(low_disc), starting, "Low discipline")

    return {
        "discipline_vs_performance": {
            "buckets": _discipline_buckets(trades, starting=starting),
            "scatter": [
                {
                    "trade_id": t.id,
                    "discipline_score": t.discipline_score,
                    "net_pnl": money(t.net_pnl),
                    "realized_r": ratio(t.r_multiple) if t.r_multiple is not None else None,
                    "result": t.classify_outcome(),
                }
                for t in closed
                if t.discipline_score is not None
            ],
            "high_vs_low": {
                "high_discipline": high_row,
                "low_discipline": low_row,
                "disclaimer": "Association between discipline score and outcomes in your history.",
            },
            "confidence": confidence_payload(len(with_disc), metric="Discipline scores"),
        },
        "checklist_impact": {
            "complete": complete_row,
            "incomplete": incomplete_row,
            "completion_rate": ratio(Decimal(len(complete)) / Decimal(len(with_checklist)) * Decimal("100")) if with_checklist else None,
            "disclaimer": "In your historical sample, trades with completed checklists vs incomplete. Association only.",
            "confidence": confidence_payload(len(with_checklist), metric="Checklist data"),
            "items": build_checklist_item_analytics(trades, starting=starting)["items"],
        },
        "risk_adherence": {
            "categories": _risk_adherence(trades, configured_risk=configured_risk),
            "configured_risk": str(configured_risk) if configured_risk else None,
            "confidence": confidence_payload(n, metric="Risk adherence"),
        },
        "sample_size": n,
    }
