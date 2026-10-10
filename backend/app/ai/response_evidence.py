"""Server-built evidence manifest attached to AI output envelopes.

References are derived from validated application context, never from model-generated text.
"""

from __future__ import annotations

from typing import Any


def build_response_evidence(context: dict[str, Any]) -> dict[str, Any]:
    raw_refs = context.get("evidence_refs")
    if not isinstance(raw_refs, list):
        raw_refs = []
    refs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw_refs:
        if not isinstance(item, dict):
            continue
        trade_id = item.get("trade_id")
        if not isinstance(trade_id, str) or not trade_id or trade_id in seen:
            continue
        seen.add(trade_id)
        refs.append({
            "trade_id": trade_id,
            "role": str(item.get("role") or "supporting_trade"),
            "symbol": str(item.get("symbol") or "Unknown instrument"),
            "status": str(item.get("status") or "unknown"),
            "entry_at": item.get("entry_at"),
            "exit_at": item.get("exit_at"),
            "net_pnl": item.get("net_pnl"),
            "r_multiple": item.get("r_multiple"),
        })

    research_context = context.get("research_context")
    if not isinstance(research_context, dict):
        research_context = {}
    sample = research_context.get("sample")
    if sample is None:
        metrics = context.get("selected") or context.get("overall") or context.get("last_n") or {}
        historical = context.get("historical_at_the_time") or {}
        sample = {
            "n": metrics.get("n", historical.get("comparable_trades")),
            "confidence": metrics.get("evidence_confidence") or historical.get("evidence_confidence"),
            "reason": metrics.get("sample_note") or historical.get("confidence_reason"),
        }
    filters = research_context.get("filters")
    if filters is None and isinstance(context.get("period"), dict):
        period = context["period"]
        filters = {
            "period_label": period.get("label"),
            "preset": period.get("preset"),
            "start": period.get("start"),
            "end": period.get("end"),
            "timezone": context.get("user", {}).get("timezone") if isinstance(context.get("user"), dict) else None,
        }
    return {
        "source": "server_validated_context",
        "supporting_trades": refs,
        "source_trade_count": len(refs),
        "sample": sample,
        "filters": filters,
        "limitations": (
            ["No direct trade-level references were included; interpret this as aggregate-context analysis."]
            if not refs
            else []
        ),
    }
