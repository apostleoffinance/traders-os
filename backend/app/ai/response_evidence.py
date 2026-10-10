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
    return {
        "source": "server_validated_context",
        "supporting_trades": refs,
        "source_trade_count": len(refs),
        "sample": research_context.get("sample"),
        "filters": research_context.get("filters"),
        "limitations": (
            ["No direct trade-level references were included; interpret this as aggregate-context analysis."]
            if not refs
            else []
        ),
    }
