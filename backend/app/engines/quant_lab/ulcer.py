"""Ulcer Index — depth and persistence of drawdowns."""

from __future__ import annotations

from decimal import Decimal
from math import sqrt
from typing import Sequence

from app.engines.fx_math import ZERO, ratio
from app.engines.risk_engine import EquityPoint


def ulcer_index(curve: Sequence[EquityPoint]) -> dict:
    """Ulcer Index = sqrt(mean(drawdown_pct²)) on percentage drawdowns."""
    if len(curve) < 2:
        return {"ulcer_index": None, "period": len(curve), "sample_size": len(curve), "available": False}
    pcts = [float(p.drawdown_pct) for p in curve if p.peak > ZERO]
    if not pcts:
        return {"ulcer_index": None, "period": len(curve), "sample_size": 0, "available": False}
    mean_sq = sum(p * p for p in pcts) / len(pcts)
    ui = sqrt(mean_sq)
    return {
        "ulcer_index": ratio(Decimal(str(ui))),
        "period": len(curve),
        "sample_size": len(pcts),
        "available": True,
        "formula": "sqrt(mean(drawdown_pct²))",
        "note": "Ulcer Index measures the depth and persistence of drawdowns.",
        "category": "OBSERVED_PERFORMANCE",
    }


def ulcer_index_r(curve: Sequence[dict]) -> dict:
    if len(curve) < 2:
        return {"ulcer_index_r": None, "period": len(curve), "sample_size": len(curve), "available": False}
    dds = [float(p.get("drawdown_r") or 0) for p in curve]
    mean_sq = sum(d * d for d in dds) / len(dds)
    ui = sqrt(mean_sq)
    return {
        "ulcer_index_r": ratio(Decimal(str(ui))),
        "period": len(curve),
        "sample_size": len(dds),
        "available": True,
        "formula": "sqrt(mean(drawdown_r²))",
        "category": "OBSERVED_PERFORMANCE",
    }
