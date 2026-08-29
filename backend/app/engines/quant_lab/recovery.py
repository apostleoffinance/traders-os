"""Recovery factor — net profit / |max drawdown|."""

from __future__ import annotations

from decimal import Decimal

from app.engines.fx_math import ZERO, ratio


def recovery_factor(net_profit: Decimal, max_drawdown: Decimal | None) -> dict:
    if max_drawdown is None or max_drawdown <= ZERO:
        return {
            "recovery_factor": None,
            "available": False,
            "note": "Recovery factor requires a positive maximum drawdown.",
        }
    if net_profit <= ZERO:
        return {
            "recovery_factor": ratio(net_profit / max_drawdown),
            "available": True,
            "note": "Negative net profit with positive drawdown.",
        }
    return {
        "recovery_factor": ratio(net_profit / max_drawdown),
        "available": True,
        "formula": "Net profit / |maximum drawdown|",
        "category": "OBSERVED_PERFORMANCE",
    }
