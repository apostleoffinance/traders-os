"""Per-checklist-item association analytics."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group


def build_checklist_item_analytics(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    """Compare outcomes when each checklist item was checked vs unchecked."""
    closed = closed_trades(list(trades))
    by_item: dict[str, dict] = defaultdict(lambda: {"label": "", "category": "", "required": False, "checked": [], "unchecked": []})

    for t in closed:
        if not t.checklist_items:
            continue
        for item in t.checklist_items:
            bucket = by_item[item.item_id]
            bucket["label"] = item.label
            bucket["category"] = item.category
            bucket["required"] = item.required
            if item.checked:
                bucket["checked"].append(t)
            else:
                bucket["unchecked"].append(t)

    rows = []
    for item_id, data in sorted(by_item.items(), key=lambda kv: kv[1]["label"]):
        checked_row = dump_perf_group(data["label"], journal_rows(data["checked"]), starting, "Checked")
        unchecked_row = dump_perf_group(data["label"], journal_rows(data["unchecked"]), starting, "Unchecked")
        rows.append(
            {
                "item_id": item_id,
                "label": data["label"],
                "category": data["category"],
                "required": data["required"],
                "checked": {
                    "n": checked_row["n"],
                    "win_rate": checked_row["win_rate"],
                    "expectancy_r": checked_row["expectancy_r"],
                    "average_r": checked_row["average_r"],
                    "net_pnl": checked_row["net_pnl"],
                    "evidence": checked_row["evidence"],
                },
                "unchecked": {
                    "n": unchecked_row["n"],
                    "win_rate": unchecked_row["win_rate"],
                    "expectancy_r": unchecked_row["expectancy_r"],
                    "average_r": unchecked_row["average_r"],
                    "net_pnl": unchecked_row["net_pnl"],
                    "evidence": unchecked_row["evidence"],
                },
                "disclaimer": (
                    f"In your historical sample, trades where '{data['label']}' was completed "
                    "vs not completed. Association only — not causation."
                ),
            }
        )

    with_items = sum(1 for t in closed if t.checklist_items)
    return {
        "items": rows,
        "trades_with_checklist": with_items,
        "confidence": confidence_payload(with_items, metric="Checklist items"),
        "sample_note": None if with_items >= 5 else "Need more trades with checklist responses for item-level analysis.",
    }
