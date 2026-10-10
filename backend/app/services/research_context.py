"""Shared provenance, filter and sample context for trader-facing research APIs."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from app.engines.evidence import evidence_payload


def _value(row: Any, *names: str) -> Any:
    for name in names:
        value = getattr(row, name, None)
        if value is not None:
            return value
    return None


def build_research_context(
    rows: Sequence[Any],
    *,
    filters: Mapping[str, Any],
    timezone: str,
    total_account_trades: int | None = None,
) -> dict[str, Any]:
    """Describe the exact cohort behind a result without changing its calculations.

    Works with both ORM Trade records and AnalyticsTrade rows. Metric-specific engines
    may retain stricter thresholds; this context gives every research response a common
    sample/evidence envelope and data-quality disclosure.
    """
    closed = [
        row for row in rows
        if str(_value(row, "status") or "").lower() == "closed"
        and _value(row, "exit_timestamp", "exit_at") is not None
    ]
    open_count = max(0, len(rows) - len(closed))
    missing_pnl = sum(
        1 for row in closed
        if _value(row, "realized_pnl", "net_pnl") is None
    )
    missing_r = sum(
        1 for row in closed
        if _value(row, "realized_r", "r_multiple") is None
    )
    valid_for_performance = len(closed) - missing_pnl
    sample = evidence_payload(len(closed))
    notes: list[str] = []
    if not closed:
        notes.append("No closed trades match the selected filters.")
    if missing_pnl:
        notes.append(f"{missing_pnl} closed trade(s) have no realized P&L and are excluded from performance calculations.")
    if missing_r:
        notes.append(f"{missing_r} closed trade(s) have no R multiple; R-based metrics use fewer observations.")
    if 0 < len(closed) < 10:
        notes.append("Treat observed patterns as descriptive, not as a proven trading edge.")

    normalized_filters = {
        key: (str(value) if value is not None else None)
        for key, value in filters.items()
    }
    return {
        "timezone": timezone,
        "filters": normalized_filters,
        "population": {
            "account_trades": total_account_trades if total_account_trades is not None else len(rows),
            "filtered_trades": len(rows),
            "closed_trades": len(closed),
            "open_or_unclosed_trades": open_count,
            "closed_trades_with_pnl": valid_for_performance,
            "closed_trades_missing_pnl": missing_pnl,
            "closed_trades_missing_r": missing_r,
        },
        "sample": sample,
        "limitations": notes,
    }
