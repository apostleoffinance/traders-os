"""Drawdown engine — currency and R-multiple equity."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.core.enums import TradeStatus
from app.core.time import as_utc
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.analytics_views import drawdown_episodes
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.sample_policy import sample_payload
from app.engines.risk_engine import ClosedTrade, EquityPoint, build_equity_curve


def _r_curve(trades: Sequence[AnalyticsTrade]) -> list[dict]:
    ordered = ordered_closed(trades)
    cumulative = ZERO
    peak = ZERO
    points: list[dict] = []
    for i, t in enumerate(ordered, start=1):
        if t.r_multiple is None:
            continue
        cumulative += t.r_multiple
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        points.append(
            {
                "trade_number": i,
                "at": t.exit_at.isoformat() if t.exit_at else None,
                "cumulative_r": ratio(cumulative),
                "peak_r": ratio(peak),
                "drawdown_r": ratio(dd),
            }
        )
    return points


def _trade_drawdown_episodes(curve: Sequence[dict], *, key: str = "drawdown_r") -> dict:
    if len(curve) < 2:
        return {"n_episodes": 0, "episodes": [], "max_episode": None}
    episodes = []
    in_dd = False
    start_i = trough_i = 0
    peak_val = curve[0].get("peak_r") or curve[0].get("peak") or ZERO
    max_depth = ZERO
    max_ep: dict | None = None
    for i, p in enumerate(curve):
        dd = Decimal(str(p.get(key) or 0))
        if dd > ZERO and not in_dd:
            in_dd = True
            start_i = i
            trough_i = i
            depth = dd
        elif in_dd:
            if dd > depth:
                depth = dd
                trough_i = i
            if dd <= ZERO:
                episodes.append(
                    {
                        "start_trade": start_i + 1,
                        "trough_trade": trough_i + 1,
                        "recovery_trade": i + 1,
                        "depth": ratio(depth),
                        "duration_trades": i - start_i + 1,
                        "recovery_trades": i - trough_i,
                        "recovered": True,
                    }
                )
                if depth > max_depth:
                    max_depth = depth
                    max_ep = episodes[-1]
                in_dd = False
    if in_dd:
        ep = {
            "start_trade": start_i + 1,
            "trough_trade": trough_i + 1,
            "recovery_trade": None,
            "depth": ratio(depth),
            "duration_trades": len(curve) - start_i,
            "recovery_trades": None,
            "recovered": False,
        }
        episodes.append(ep)
        if depth > max_depth:
            max_ep = ep
    return {"n_episodes": len(episodes), "episodes": episodes, "max_episode": max_ep}


def build_drawdown(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
) -> dict:
    closed = ordered_closed(trades)
    closed_views = [
        ClosedTrade(
            id=t.id,
            entry_at=t.entry_at,
            exit_at=t.exit_at,
            risk_amount=t.risk_amount,
            realized_pnl=t.net_pnl,
            result=t.result,
            status=TradeStatus.CLOSED,
        )
        for t in closed
    ]
    net_curve = build_equity_curve(starting, closed_views)
    r_curve = _r_curve(closed)
    currency_eps = drawdown_episodes(net_curve) if len(net_curve) >= 2 else {"n_episodes": 0, "episodes": []}
    r_eps = _trade_drawdown_episodes(r_curve)

    max_dd = max((p.drawdown for p in net_curve), default=ZERO) if net_curve else ZERO
    max_dd_r = max((Decimal(str(p["drawdown_r"])) for p in r_curve), default=ZERO) if r_curve else None

    current_dd = net_curve[-1].drawdown if net_curve else ZERO
    current_dd_r = Decimal(str(r_curve[-1]["drawdown_r"])) if r_curve else None

    max_ep = currency_eps.get("episodes", [])
    deepest = max(max_ep, key=lambda e: e.get("depth", ZERO), default=None) if max_ep else None

    return {
        "currency": {
            "max_drawdown": money(max_dd) if net_curve else None,
            "current_drawdown": money(current_dd) if net_curve else None,
            "average_drawdown": money(sum((p.drawdown for p in net_curve), ZERO) / Decimal(len(net_curve)))
            if net_curve
            else None,
            "n_drawdown_periods": currency_eps.get("n_episodes", 0),
            "underwater_curve": [
                {
                    "at": p.at.isoformat(),
                    "equity": p.equity,
                    "peak": p.peak,
                    "drawdown": p.drawdown,
                    "drawdown_pct": p.drawdown_pct,
                }
                for p in net_curve
            ],
            "episodes": currency_eps,
            "max_episode": deepest,
        },
        "r_multiple": {
            "max_drawdown_r": ratio(max_dd_r) if max_dd_r is not None else None,
            "current_drawdown_r": ratio(current_dd_r) if current_dd_r is not None else None,
            "curve": r_curve,
            "episodes": r_eps,
            "max_episode": r_eps.get("max_episode"),
            "valid_r_trades": len(r_curve),
        },
        "method": "Drawdown measured from running peak on filtered closed trades.",
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(closed)),
    }
