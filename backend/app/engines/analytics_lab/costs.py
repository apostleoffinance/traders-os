"""Cost analytics — commission, swap, gross vs net."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades
from app.engines.fx_math import ZERO, money, ratio


def build_costs(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    if n == 0:
        empty = {
            "n": 0,
            "sample_note": sample_note(0),
            "evidence": with_evidence(0),
        }
        return {
            "commissions": {**empty, "total": None, "average": None, "median": None, "by_instrument": []},
            "swaps": {**empty, "total": None, "average": None, "by_instrument": [], "positive": None, "negative": None},
            "gross_vs_net": {**empty},
        }

    commissions = [t.commission for t in closed]
    swaps = [t.swap for t in closed]
    total_commission = sum(commissions, ZERO)
    total_swap = sum(swaps, ZERO)
    total_cost = sum((t.trading_cost for t in closed), ZERO)
    gross_pnl = sum((t.gross_pnl for t in closed), ZERO)
    net_pnl = sum((t.net_pnl for t in closed), ZERO)

    has_commission_data = any(c != ZERO for c in commissions)
    has_swap_data = any(s != ZERO for s in swaps)

    by_inst_comm: dict[str, Decimal] = defaultdict(lambda: ZERO)
    by_inst_swap: dict[str, Decimal] = defaultdict(lambda: ZERO)
    for t in closed:
        by_inst_comm[t.symbol] += t.commission
        by_inst_swap[t.symbol] += t.swap

    cost_drag = None
    cost_drag_note = None
    if abs(gross_pnl) > ZERO:
        cost_drag = ratio(total_cost / abs(gross_pnl) * 100)
    else:
        cost_drag_note = "Cost drag ratio undefined — gross P&L near zero."

    comm_pct_gross = None
    if gross_pnl > ZERO:
        comm_pct_gross = ratio(abs(total_commission) / gross_pnl * 100)

    return {
        "commissions": {
            "total": money(total_commission),
            "average": money(total_commission / Decimal(n)),
            "median": money(sorted(commissions)[n // 2]),
            "by_instrument": [
                {"symbol": sym, "total": money(amt)} for sym, amt in sorted(by_inst_comm.items())
            ],
            "pct_of_gross_profit": comm_pct_gross,
            "data_available": has_commission_data,
            "missing_note": None if has_commission_data else "Commission data was not provided by the broker for these trades.",
            "n": n,
            "evidence": with_evidence(n),
        },
        "swaps": {
            "total": money(total_swap),
            "average": money(total_swap / Decimal(n)),
            "positive": money(sum((s for s in swaps if s > ZERO), ZERO)),
            "negative": money(sum((s for s in swaps if s < ZERO), ZERO)),
            "by_instrument": [
                {"symbol": sym, "total": money(amt)} for sym, amt in sorted(by_inst_swap.items())
            ],
            "data_available": has_swap_data,
            "missing_note": None if has_swap_data else "Swap data was not provided for these trades.",
            "n": n,
            "evidence": with_evidence(n),
        },
        "gross_vs_net": {
            "gross_pnl": money(gross_pnl),
            "commission": money(total_commission),
            "swap": money(total_swap),
            "total_trading_cost": money(total_cost),
            "net_pnl": money(net_pnl),
            "cost_drag_pct": cost_drag,
            "cost_drag_note": cost_drag_note,
            "sign_convention": (
                "net_pnl = gross_pnl + commission + swap (MT5 convention). "
                "Commission and swap are stored as reported by the broker (typically negative for costs)."
            ),
            "n": n,
            "sample_note": sample_note(n),
            "evidence": with_evidence(n),
        },
    }
