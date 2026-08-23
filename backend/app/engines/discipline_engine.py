"""Discipline scoring independent of profitability.

A losing, rules-followed trade can score highly. A winning, impulsive trade
can score poorly. Weights are defined here so they can later be stored per
user without rewriting the engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from app.core.enums import SessionName
from app.engines.fx_math import ZERO, ratio
from app.engines.session_engine import in_preferred_window

WEIGHTS = {
    "risk_adherence": 20,
    "setup_discipline": 15,
    "checklist_adherence": 15,
    "sl_discipline": 10,
    "tp_discipline": 5,
    "session_adherence": 10,
    "trade_frequency": 10,
    "emotional_control": 10,
    "revenge_avoidance": 5,
}
assert sum(WEIGHTS.values()) == 100


@dataclass
class TradeDisciplineInput:
    planned_risk: Decimal
    risk_limit: Decimal
    setup_valid: bool
    rules_followed: bool
    stop_loss_set: bool
    take_profit_set: bool
    planned_rr: Decimal | None
    preferred_min_rr: Decimal
    session: SessionName
    in_preferred_session: bool
    checklist_checked: int
    checklist_total: int
    emotional_trade: bool
    revenge: bool
    mistake: bool
    trades_today_including_this: int
    max_trades_per_day: int


@dataclass
class DisciplineBreakdown:
    risk_adherence: int
    setup_discipline: int
    checklist_adherence: int
    sl_discipline: int
    tp_discipline: int
    session_adherence: int
    trade_frequency: int
    emotional_control: int
    revenge_avoidance: int
    total: int
    notes: list[str]


def _clip(score: float, high: int) -> int:
    return int(max(0, min(high, round(score))))


def score_trade(inp: TradeDisciplineInput) -> DisciplineBreakdown:
    notes: list[str] = []

    # Risk: full marks at or below limit; linear decay to 0 at 2x limit.
    if inp.risk_limit <= ZERO:
        risk = 0
        notes.append("No risk-per-trade limit configured.")
    elif inp.planned_risk <= inp.risk_limit:
        risk = WEIGHTS["risk_adherence"]
    else:
        over = float(inp.planned_risk / inp.risk_limit)
        risk = _clip((2.0 - over) / 1.0 * WEIGHTS["risk_adherence"], WEIGHTS["risk_adherence"])
        notes.append("Planned risk exceeded configured unit.")

    setup = WEIGHTS["setup_discipline"] if inp.setup_valid else 0
    if not inp.setup_valid:
        notes.append("Setup marked invalid — no setup = no trade.")

    if inp.checklist_total <= 0:
        checklist = WEIGHTS["checklist_adherence"]
    else:
        checklist = _clip(
            inp.checklist_checked / inp.checklist_total * WEIGHTS["checklist_adherence"],
            WEIGHTS["checklist_adherence"],
        )
        if inp.checklist_checked < inp.checklist_total:
            notes.append("Checklist incomplete.")

    sl = WEIGHTS["sl_discipline"] if inp.stop_loss_set and not inp.mistake else (
        WEIGHTS["sl_discipline"] if inp.stop_loss_set else 0
    )
    if not inp.stop_loss_set:
        sl = 0
        notes.append("No stop-loss recorded.")
    elif inp.mistake and not inp.rules_followed:
        sl = _clip(sl * 0.4, WEIGHTS["sl_discipline"])
        notes.append("Mistake flagged; stop discipline reduced.")

    tp = WEIGHTS["tp_discipline"] if inp.take_profit_set else _clip(
        WEIGHTS["tp_discipline"] * 0.4, WEIGHTS["tp_discipline"]
    )
    if inp.planned_rr is not None and inp.preferred_min_rr > ZERO:
        if inp.planned_rr < inp.preferred_min_rr:
            tp = _clip(tp * 0.5, WEIGHTS["tp_discipline"])
            notes.append("Planned R:R below configured minimum.")

    session = WEIGHTS["session_adherence"] if inp.in_preferred_session else 0
    if not inp.in_preferred_session:
        notes.append("Trade outside preferred session windows.")
    if inp.session == SessionName.OUTSIDE:
        session = min(session, 2)

    freq = WEIGHTS["trade_frequency"]
    if inp.max_trades_per_day > 0 and inp.trades_today_including_this > inp.max_trades_per_day:
        freq = 0
        notes.append("Trade count exceeded daily maximum.")
    elif inp.max_trades_per_day > 0 and inp.trades_today_including_this == inp.max_trades_per_day:
        freq = WEIGHTS["trade_frequency"]  # at the cap is still adherent

    emotional = 0 if inp.emotional_trade else WEIGHTS["emotional_control"]
    if inp.emotional_trade:
        notes.append("Marked as an emotional trade.")

    revenge = 0 if inp.revenge else WEIGHTS["revenge_avoidance"]
    if inp.revenge:
        notes.append("Revenge trading flagged.")

    if not inp.rules_followed:
        notes.append("Rules not followed.")
        setup = _clip(setup * 0.5, WEIGHTS["setup_discipline"])
        emotional = _clip(emotional * 0.5, WEIGHTS["emotional_control"])

    parts = {
        "risk_adherence": risk,
        "setup_discipline": setup,
        "checklist_adherence": checklist,
        "sl_discipline": sl,
        "tp_discipline": tp,
        "session_adherence": session,
        "trade_frequency": freq,
        "emotional_control": emotional,
        "revenge_avoidance": revenge,
    }
    total = int(sum(parts.values()))
    return DisciplineBreakdown(total=total, notes=notes, **parts)


def aggregate_discipline(scores: Sequence[int], last_n: int = 20) -> int | None:
    if not scores:
        return None
    window = list(scores)[-last_n:]
    return int(round(sum(window) / len(window)))
