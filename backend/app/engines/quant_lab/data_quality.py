"""Quant Lab data validation — exclude invalid observations explicitly."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.core.enums import TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade, BREAKEVEN_EPS, ordered_closed
from app.engines.fx_math import ZERO


def validate_quant_trades(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = ordered_closed(trades)
    exclusions: dict[str, int] = defaultdict(int)
    valid: list[AnalyticsTrade] = []
    seen_ids: set[str] = set()

    for t in closed:
        if t.id in seen_ids:
            exclusions["duplicate"] += 1
            continue
        seen_ids.add(t.id)

        if t.exit_at is None:
            exclusions["missing_exit"] += 1
            continue
        if t.entry_at is None:
            exclusions["invalid_entry"] += 1
            continue
        if t.net_pnl is None:
            exclusions["missing_pnl"] += 1
            continue

        valid.append(t)

    valid_r = [t for t in valid if t.r_multiple is not None]
    missing_r = len(valid) - len(valid_r)
    zero_risk = sum(1 for t in valid if t.risk_amount <= ZERO)

    return {
        "total_trades": len(closed),
        "valid_quant_trades": len(valid),
        "valid_r_trades": len(valid_r),
        "excluded_trades": len(closed) - len(valid),
        "exclusions": dict(exclusions),
        "flags": {
            "missing_r": missing_r,
            "zero_risk": zero_risk,
            "breakeven": sum(1 for t in valid if abs(t.net_pnl) <= BREAKEVEN_EPS),
        },
        "status": "OK" if len(valid) >= 1 else "NO_DATA",
        "valid_trade_ids": [t.id for t in valid],
    }


def filter_valid(trades: Sequence[AnalyticsTrade]) -> list[AnalyticsTrade]:
    report = validate_quant_trades(trades)
    valid_ids = set(report["valid_trade_ids"])
    return [t for t in ordered_closed(trades) if t.id in valid_ids]
