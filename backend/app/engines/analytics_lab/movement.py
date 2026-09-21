"""Instrument-aware movement summaries for Analytics Lab."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades
from app.engines.price_movement import trade_movement_metrics


def _average(values: list[Decimal]) -> Decimal | None:
    return sum(values, Decimal("0")) / Decimal(len(values)) if values else None


def build_movement_analytics(trades: Sequence[AnalyticsTrade]) -> dict:
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for trade in closed_trades(list(trades)):
        metrics = trade_movement_metrics(
            symbol=trade.symbol,
            direction=trade.direction,
            entry=trade.entry_price,
            stop_loss=trade.stop_loss,
            take_profit=trade.take_profit,
            exit_price=trade.exit_price,
            mfe_price=trade.mfe_price,
            mae_price=trade.mae_price,
        )
        key = (trade.symbol, metrics["unit"], metrics["label"])
        groups[key].append(metrics)

    rows = []
    for (symbol, unit, label), items in sorted(groups.items()):
        def vals(name: str) -> list[Decimal]:
            return [item[name] for item in items if item.get(name) is not None]

        captures = vals("capture_percent")
        rows.append(
            {
                "symbol": symbol,
                "unit": unit,
                "label": label,
                "n": len(items),
                "average_risk": _average(vals("risk")),
                "average_target": _average(vals("target")),
                "average_realized": _average(vals("realized")),
                "average_mfe": _average(vals("mfe")),
                "average_mae": _average(vals("mae")),
                "average_capture_percent": _average(captures),
            }
        )

    return {
        "by_instrument": rows,
        "mixed_units": len({row["unit"] for row in rows}) > 1,
        "note": "Raw movement values are grouped by instrument and native unit; use R or percentage metrics for cross-instrument comparison.",
    }