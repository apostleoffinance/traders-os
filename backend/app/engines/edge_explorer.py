"""Edge Explorer — instrument × session matrix and combo comparisons."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import mean
from typing import Sequence

from app.engines.analytics_views import JournalTrade, closed_only
from app.engines.discipline_engine import aggregate_discipline
from app.engines.evidence import evidence_payload
from app.engines.fx_math import ZERO, ratio
from app.engines.performance_engine import compute_performance
from app.engines.risk_engine import ClosedTrade


def _cell_metrics(items: Sequence[JournalTrade], starting: Decimal) -> dict:
    if not items:
        return {
            "n": 0,
            "expectancy_r": None,
            "win_rate": None,
            "profit_factor": None,
            "average_r": None,
            "discipline_avg": None,
            "net_pnl": None,
            "evidence": evidence_payload(0),
        }
    closed = [to_closed(j) for j in items]
    perf = compute_performance(closed, starting)
    disc = [j.discipline_score for j in items if j.discipline_score is not None]
    return {
        "n": perf.n_trades,
        "expectancy_r": perf.expectancy_r,
        "win_rate": perf.win_rate,
        "profit_factor": perf.profit_factor,
        "average_r": perf.average_r,
        "discipline_avg": aggregate_discipline(disc) if disc else None,
        "net_pnl": perf.net_pnl,
        "evidence": evidence_payload(perf.n_trades),
    }


def to_closed(j: JournalTrade) -> ClosedTrade:
    return ClosedTrade(
        id=j.id,
        entry_at=j.entry_at,
        exit_at=j.exit_at,
        risk_amount=j.risk_amount,
        realized_pnl=j.realized_pnl,
        result=j.result,
        status=j.status,
    )


def edge_matrix(journal: Sequence[JournalTrade], starting: Decimal) -> dict:
    closed = closed_only(journal)
    symbols = sorted({t.symbol for t in closed})
    sessions = sorted({t.session for t in closed})
    buckets: dict[tuple[str, str], list[JournalTrade]] = defaultdict(list)
    for t in closed:
        buckets[(t.symbol, t.session)].append(t)

    cells = []
    for sym in symbols:
        for sess in sessions:
            items = buckets.get((sym, sess), [])
            m = _cell_metrics(items, starting)
            exp = Decimal(m["expectancy_r"]) if m["expectancy_r"] is not None else None
            tone = "neutral"
            if m["n"] > 0 and exp is not None:
                if exp >= Decimal("0.25"):
                    tone = "positive"
                elif exp <= Decimal("-0.15"):
                    tone = "negative"
                else:
                    tone = "mixed"
            cells.append(
                {
                    "symbol": sym,
                    "session": sess,
                    "tone": tone,
                    **m,
                }
            )

    return {
        "symbols": symbols,
        "sessions": sessions,
        "cells": cells,
        "evidence": evidence_payload(len(closed)),
    }


def edge_detail(
    journal: Sequence[JournalTrade],
    starting: Decimal,
    *,
    symbol: str,
    session: str,
    setup: str | None = None,
    direction: str | None = None,
) -> dict:
    closed = closed_only(journal)

    def match(t: JournalTrade) -> bool:
        if t.symbol.upper() != symbol.upper():
            return False
        if t.session != session:
            return False
        if setup and t.setup != setup:
            return False
        if direction and t.direction != direction:
            return False
        return True

    subset = [t for t in closed if match(t)]
    rest = [t for t in closed if not match(t)]
    edge = _cell_metrics(subset, starting)
    baseline = _cell_metrics(rest, starting)

    setups_in_cell: dict[str, int] = defaultdict(int)
    for t in subset:
        setups_in_cell[t.setup] += 1
    top_setup = max(setups_in_cell.items(), key=lambda kv: kv[1])[0] if setups_in_cell else None

    hold_secs = [t.holding_time_seconds for t in subset if t.holding_time_seconds]
    avg_hold = int(mean(hold_secs)) if hold_secs else None

    return {
        "symbol": symbol,
        "session": session,
        "setup": setup,
        "direction": direction,
        "edge": edge,
        "rest": baseline,
        "top_setup": top_setup,
        "avg_holding_seconds": avg_hold,
        "label": " × ".join(x for x in [symbol, session, setup, direction] if x),
    }


def ranked_combos(
    journal: Sequence[JournalTrade],
    starting: Decimal,
    *,
    min_n: int = 5,
    limit: int = 12,
) -> list[dict]:
    closed = closed_only(journal)
    combos: dict[tuple[str, str, str], list[JournalTrade]] = defaultdict(list)
    for t in closed:
        combos[(t.symbol, t.session, t.setup)].append(t)

    rows = []
    for (sym, sess, setup), items in combos.items():
        if len(items) < min_n:
            continue
        m = _cell_metrics(items, starting)
        if m["expectancy_r"] is None:
            continue
        rows.append(
            {
                "symbol": sym,
                "session": sess,
                "setup": setup,
                **m,
                "label": f"{sym} · {sess} · {setup}",
            }
        )
    rows.sort(key=lambda r: Decimal(r["expectancy_r"] or 0), reverse=True)
    return rows[:limit]
