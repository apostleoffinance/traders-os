"""Equity curve, drawdown, and recovery analytics."""

from __future__ import annotations

from decimal import Decimal
from typing import Callable, Sequence

from app.core.enums import TradeStatus
from app.core.time import as_utc
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.analytics_views import drawdown_episodes
from app.engines.fx_math import ZERO, money, ratio
from app.engines.risk_engine import ClosedTrade, EquityPoint, build_equity_curve


def _to_closed_trade(t: AnalyticsTrade, pnl_fn: Callable[[AnalyticsTrade], Decimal]) -> ClosedTrade:
    return ClosedTrade(
        id=t.id,
        entry_at=t.entry_at,
        exit_at=t.exit_at,
        risk_amount=t.risk_amount,
        realized_pnl=pnl_fn(t),
        result=t.result,
        status=TradeStatus.CLOSED,
    )


def _build_gross_curve(starting: Decimal, trades: Sequence[AnalyticsTrade]) -> list[EquityPoint]:
    closed = ordered_closed(trades)
    equity = starting
    peak = starting
    cumulative_r = ZERO
    points: list[EquityPoint] = []
    if not closed:
        return points
    points.append(
        EquityPoint(
            at=as_utc(closed[0].entry_at),
            equity=starting,
            peak=peak,
            drawdown=ZERO,
            drawdown_pct=ZERO,
            daily_pnl=ZERO,
            cumulative_r=ZERO,
        )
    )
    for trade in closed:
        exit_at = as_utc(trade.exit_at)  # type: ignore[arg-type]
        pnl = trade.gross_pnl
        equity += pnl
        if trade.r_multiple is not None:
            cumulative_r += trade.r_multiple
        if equity > peak:
            peak = equity
        dd = peak - equity
        dd_pct = (dd / peak * Decimal("100")) if peak > ZERO else ZERO
        points.append(
            EquityPoint(
                at=exit_at,
                equity=money(equity),
                peak=money(peak),
                drawdown=money(dd),
                drawdown_pct=ratio(dd_pct),
                daily_pnl=money(pnl),
                cumulative_r=ratio(cumulative_r),
            )
        )
    return points


def _serialize_curve(points: Sequence[EquityPoint], *, value_key: str = "equity") -> list[dict]:
    out = []
    for p in points:
        row = {
            "at": p.at.isoformat(),
            "equity": p.equity,
            "peak": p.peak,
            "drawdown": p.drawdown,
            "drawdown_pct": p.drawdown_pct,
            "daily_pnl": p.daily_pnl,
            "cumulative_r": p.cumulative_r,
        }
        if value_key == "gross_equity":
            row["gross_equity"] = p.equity
        out.append(row)
    return out


def _drawdown_metrics(curve: Sequence[EquityPoint]) -> dict:
    if len(curve) < 2:
        return {
            "max_drawdown": None,
            "max_drawdown_pct": None,
            "current_drawdown": None,
            "current_drawdown_pct": None,
            "average_drawdown": None,
            "n_drawdown_periods": 0,
            "longest_duration_days": 0,
        }
    dds = [p.drawdown for p in curve]
    dd_pcts = [p.drawdown_pct for p in curve]
    episodes = drawdown_episodes(curve)
    completed = [e for e in episodes["episodes"] if e["recovered"]]
    durations = [e["duration_days"] for e in completed]
    return {
        "max_drawdown": money(max(dds)),
        "max_drawdown_pct": ratio(max(dd_pcts)),
        "current_drawdown": money(curve[-1].drawdown),
        "current_drawdown_pct": ratio(curve[-1].drawdown_pct),
        "average_drawdown": money(sum(dds, ZERO) / Decimal(len(dds))),
        "n_drawdown_periods": episodes["n_episodes"],
        "longest_duration_days": max(durations) if durations else 0,
    }


def _recovery_table(curve: Sequence[EquityPoint]) -> list[dict]:
    episodes = drawdown_episodes(curve)["episodes"]
    rows = []
    for i, ep in enumerate(episodes, start=1):
        if not ep["recovered"]:
            continue
        rows.append(
            {
                "drawdown": i,
                "start": ep["start"],
                "trough": ep["start"],
                "recovery": ep["end"],
                "depth": ep["depth"],
                "duration_days": ep["duration_days"],
            }
        )
    return rows[-24:]


def _trade_markers(trades: Sequence[AnalyticsTrade]) -> list[dict]:
    return [
        {
            "trade_id": t.id,
            "at": t.exit_at.isoformat() if t.exit_at else t.entry_at.isoformat(),
            "symbol": t.symbol,
            "direction": t.direction,
            "result": t.result,
            "net_pnl": money(t.net_pnl),
            "r_multiple": ratio(t.r_multiple) if t.r_multiple is not None else None,
        }
        for t in ordered_closed(trades)
    ]


def build_equity_analytics(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = ordered_closed(trades)
    closed_views = [_to_closed_trade(t, lambda x: x.net_pnl) for t in closed]
    net_curve = build_equity_curve(starting, closed_views)
    gross_curve = _build_gross_curve(starting, closed)

    n = len(closed)
    return {
        "modes": ["net_pnl", "gross_pnl", "r_multiple"],
        "markers": _trade_markers(closed),
        "net_pnl": {
            "curve": _serialize_curve(net_curve),
            "starting_equity": money(starting),
            "n": n,
        },
        "gross_pnl": {
            "curve": _serialize_curve(gross_curve, value_key="gross_equity"),
            "starting_equity": money(starting),
            "n": n,
        },
        "r_multiple": {
            "curve": [
                {
                    "at": p.at.isoformat(),
                    "cumulative_r": p.cumulative_r,
                    "drawdown_r": None,
                }
                for p in net_curve
            ],
            "n": len([t for t in closed if t.r_multiple is not None]),
            "missing_r": n - len([t for t in closed if t.r_multiple is not None]),
        },
        "drawdown": {
            **_drawdown_metrics(net_curve),
            "curve": [
                {
                    "at": p.at.isoformat(),
                    "drawdown": p.drawdown,
                    "drawdown_pct": p.drawdown_pct,
                    "equity": p.equity,
                    "peak": p.peak,
                }
                for p in net_curve
            ],
            "episodes": drawdown_episodes(net_curve),
            "recovery_table": _recovery_table(net_curve),
            "method": "Running peak: drawdown_t = equity_t - max(equity_0..equity_t)",
        },
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
    }
