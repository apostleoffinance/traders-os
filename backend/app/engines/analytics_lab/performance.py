"""Performance tab analytics — KPIs, win/loss, direction comparison, best/worst."""

from __future__ import annotations

from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades
from app.engines.fx_math import ZERO, money, ratio


def _median_decimal(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    return Decimal(str(median([float(v) for v in values])))


def _profit_factor(wins: list[Decimal], losses: list[Decimal]) -> dict:
    gp = sum(wins, ZERO)
    gl = abs(sum(losses, ZERO))
    n = len(wins) + len(losses)
    if gl > ZERO:
        return {
            "value": ratio(gp / gl),
            "gross_profit": money(gp),
            "gross_loss": money(gl),
            "note": None,
            "n": n,
        }
    if gp > ZERO:
        return {
            "value": None,
            "gross_profit": money(gp),
            "gross_loss": money(ZERO),
            "note": "Undefined — no losing trades in selected sample",
            "n": n,
        }
    return {
        "value": None,
        "gross_profit": money(ZERO),
        "gross_loss": money(ZERO),
        "note": "Undefined — no winning trades in selected sample",
        "n": n,
    }


def _win_loss_block(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    wins = [t for t in closed if t.classify_outcome() == "win"]
    losses = [t for t in closed if t.classify_outcome() == "loss"]
    bes = [t for t in closed if t.classify_outcome() == "breakeven"]
    win_pnls = [t.net_pnl for t in wins]
    loss_pnls = [t.net_pnl for t in losses]
    win_rs = [t.r_multiple for t in wins if t.r_multiple is not None]
    loss_rs = [t.r_multiple for t in losses if t.r_multiple is not None]

    wr = ratio(Decimal(len(wins)) / Decimal(n) * 100) if n else None
    lr = ratio(Decimal(len(losses)) / Decimal(n) * 100) if n else None
    br = ratio(Decimal(len(bes)) / Decimal(n) * 100) if n else None
    avg_win = money(sum(win_pnls, ZERO) / Decimal(len(win_pnls))) if win_pnls else None
    avg_loss = money(sum(loss_pnls, ZERO) / Decimal(len(loss_pnls))) if loss_pnls else None
    med_win = money(_median_decimal(win_pnls)) if win_pnls else None
    med_loss = money(_median_decimal(loss_pnls)) if loss_pnls else None
    largest_win = money(max(win_pnls)) if win_pnls else None
    largest_loss = money(min(loss_pnls)) if loss_pnls else None
    wl_ratio = None
    if avg_win and avg_loss and avg_loss != ZERO:
        wl_ratio = ratio(abs(Decimal(str(avg_win)) / Decimal(str(avg_loss))))

    pf = _profit_factor(win_pnls, loss_pnls)

    return {
        "n": n,
        "win_rate": wr,
        "loss_rate": lr,
        "breakeven_rate": br,
        "wins": len(wins),
        "losses": len(losses),
        "breakevens": len(bes),
        "average_win": avg_win,
        "average_loss": avg_loss,
        "median_win": med_win,
        "median_loss": med_loss,
        "largest_winner": largest_win,
        "largest_loser": largest_loss,
        "win_loss_ratio": wl_ratio,
        "profit_factor": pf,
        "composition": [
            {"label": "Win", "n": len(wins), "pct": float(wr) if wr else 0},
            {"label": "Loss", "n": len(losses), "pct": float(lr) if lr else 0},
            {"label": "Breakeven", "n": len(bes), "pct": float(br) if br else 0},
        ],
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
    }


def _direction_side(trades: Sequence[AnalyticsTrade], direction: str) -> dict:
    subset = [t for t in closed_trades(list(trades)) if t.direction.lower() == direction.lower()]
    n = len(subset)
    if n == 0:
        return {"n": 0, "sample_note": f"No {direction} trades in sample."}
    wins = [t for t in subset if t.classify_outcome() == "win"]
    win_pnls = [t.net_pnl for t in wins]
    loss_pnls = [t.net_pnl for t in subset if t.classify_outcome() == "loss"]
    rs = [t.r_multiple for t in subset if t.r_multiple is not None]
    gross = sum((t.gross_pnl for t in subset), ZERO)
    net = sum((t.net_pnl for t in subset), ZERO)
    net_r = sum(rs, ZERO) if rs else None
    holds = [t.holding_time_seconds for t in subset if t.holding_time_seconds is not None]
    risks = [t.risk_amount for t in subset if t.risk_amount > ZERO]
    pf = _profit_factor(win_pnls, loss_pnls)
    return {
        "n": n,
        "win_rate": ratio(Decimal(len(wins)) / Decimal(n) * 100),
        "net_pnl": money(net),
        "gross_pnl": money(gross),
        "net_r": ratio(net_r) if net_r is not None else None,
        "average_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "expectancy_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "expectancy_currency": money(net / Decimal(n)),
        "profit_factor": pf["value"],
        "average_win": money(sum(win_pnls, ZERO) / Decimal(len(win_pnls))) if win_pnls else None,
        "average_loss": money(sum(loss_pnls, ZERO) / Decimal(len(loss_pnls))) if loss_pnls else None,
        "average_holding_seconds": int(sum(holds) / len(holds)) if holds else None,
        "average_risk": money(sum(risks, ZERO) / Decimal(len(risks))) if risks else None,
        "evidence": with_evidence(n),
        "sample_note": sample_note(n),
    }


def _trade_rank_row(t: AnalyticsTrade, rank: int) -> dict:
    return {
        "rank": rank,
        "trade_id": t.id,
        "symbol": t.symbol,
        "direction": t.direction,
        "setup": t.setup,
        "entry_at": t.entry_at.isoformat(),
        "exit_at": t.exit_at.isoformat() if t.exit_at else None,
        "net_pnl": money(t.net_pnl),
        "gross_pnl": money(t.gross_pnl),
        "r_multiple": ratio(t.r_multiple) if t.r_multiple is not None else None,
        "holding_time_seconds": t.holding_time_seconds,
        "lot_size": str(t.lot_size),
        "commission": money(t.commission),
        "swap": money(t.swap),
    }


def build_performance(trades: Sequence[AnalyticsTrade], starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    wl = _win_loss_block(trades)
    net = money(sum((t.net_pnl for t in closed), ZERO))
    gross = money(sum((t.gross_pnl for t in closed), ZERO))
    rs = [t.r_multiple for t in closed if t.r_multiple is not None]
    total_r = ratio(sum(rs, ZERO)) if rs else None
    holds = [t.holding_time_seconds for t in closed if t.holding_time_seconds is not None]
    avg_hold = int(sum(holds) / len(holds)) if holds else None

    from app.engines.performance_engine import compute_performance
    from app.engines.risk_engine import ClosedTrade
    from app.core.enums import TradeStatus as TS

    closed_views = [
        ClosedTrade(
            id=t.id,
            entry_at=t.entry_at,
            exit_at=t.exit_at,
            risk_amount=t.risk_amount,
            realized_pnl=t.net_pnl,
            result=t.result,
            status=TS.CLOSED,
        )
        for t in closed
    ]
    perf = compute_performance(closed_views, starting)

    ranked = sorted(closed, key=lambda t: t.net_pnl, reverse=True)
    top_winners = [_trade_rank_row(t, i + 1) for i, t in enumerate(ranked[:5])]
    top_losers = [_trade_rank_row(t, i + 1) for i, t in enumerate(sorted(closed, key=lambda t: t.net_pnl)[:5])]

    long_side = _direction_side(trades, "long")
    short_side = _direction_side(trades, "short")

    return {
        "kpis": {
            "net_pnl": {"value": net, "unit": "currency", "n": n},
            "gross_pnl": {"value": gross, "unit": "currency", "n": n},
            "net_r": {"value": total_r, "unit": "R", "n": len(rs)},
            "total_closed_trades": {"value": n, "unit": "trades", "n": n},
            "win_rate": {"value": wl["win_rate"], "unit": "%", "n": n},
            "loss_rate": {"value": wl["loss_rate"], "unit": "%", "n": n},
            "breakeven_rate": {"value": wl["breakeven_rate"], "unit": "%", "n": n},
            "profit_factor": {"value": wl["profit_factor"]["value"], "unit": "ratio", "n": n, "note": wl["profit_factor"]["note"]},
            "expectancy_currency": {"value": money(perf.expectancy_currency) if perf.expectancy_currency else None, "unit": "currency", "n": n},
            "expectancy_r": {"value": perf.expectancy_r, "unit": "R", "n": len(rs)},
            "average_win": {"value": wl["average_win"], "unit": "currency", "n": len([t for t in closed if t.classify_outcome() == "win"])},
            "average_loss": {"value": wl["average_loss"], "unit": "currency", "n": len([t for t in closed if t.classify_outcome() == "loss"])},
            "average_r": {"value": perf.average_r, "unit": "R", "n": len(rs)},
            "average_holding_seconds": {"value": avg_hold, "unit": "seconds", "n": len(holds)},
            "largest_winner": {"value": wl["largest_winner"], "unit": "currency", "n": n},
            "largest_loser": {"value": wl["largest_loser"], "unit": "currency", "n": n},
            "max_drawdown": {"value": perf.max_drawdown, "unit": "currency", "n": n},
        },
        "win_loss": wl,
        "direction_comparison": {
            "long": long_side,
            "short": short_side,
            "metrics": [
                "n",
                "win_rate",
                "net_pnl",
                "gross_pnl",
                "net_r",
                "expectancy_r",
                "profit_factor",
                "average_win",
                "average_loss",
                "average_holding_seconds",
                "average_risk",
            ],
        },
        "best_trades": {
            "winners": top_winners,
            "losers": top_losers,
            "best_winner": top_winners[0] if top_winners else None,
            "worst_loser": top_losers[0] if top_losers else None,
        },
        "sample_note": sample_note(n),
        "evidence": with_evidence(n),
    }
