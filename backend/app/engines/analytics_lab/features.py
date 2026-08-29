"""Sequential behavioural feature extraction for Phase 3."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Sequence

from app.core.time import as_utc
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.fx_math import ZERO, ratio

# Revenge classification thresholds (transparent rules)
REVENGE_MINUTES_THRESHOLD = 30
REVENGE_RISK_MULTIPLIER = Decimal("1.25")
REVENGE_LOT_MULTIPLIER = Decimal("1.20")


@dataclass(frozen=True)
class TradeContext:
    trade: AnalyticsTrade
    prev_outcome: str | None
    consecutive_losses_before: int
    consecutive_wins_before: int
    minutes_since_prev: float | None
    risk_multiplier_vs_baseline: Decimal | None
    lot_multiplier_vs_baseline: Decimal | None
    in_drawdown: bool
    is_revenge_candidate: bool
    is_rapid_followup: bool


def _baseline_risk(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    risks = [t.risk_amount for t in trades if t.risk_amount > ZERO]
    if not risks:
        return None
    return sum(risks, ZERO) / Decimal(len(risks))


def _baseline_lot(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    lots = [t.lot_size for t in trades if t.lot_size > ZERO]
    if not lots:
        return None
    return sum(lots, ZERO) / Decimal(len(lots))


def extract_contexts(
    trades: Sequence[AnalyticsTrade],
    *,
    in_drawdown_fn=None,
) -> list[TradeContext]:
    ordered = ordered_closed(trades)
    base_risk = _baseline_risk(ordered)
    base_lot = _baseline_lot(ordered)
    contexts: list[TradeContext] = []
    consec_l = 0
    consec_w = 0

    for i, t in enumerate(ordered):
        prev = ordered[i - 1] if i > 0 else None
        prev_outcome = prev.classify_outcome() if prev else None
        minutes = None
        if prev and prev.exit_at and t.entry_at:
            delta = as_utc(t.entry_at) - as_utc(prev.exit_at)
            minutes = delta.total_seconds() / 60.0

        risk_mult = None
        if base_risk and base_risk > ZERO and t.risk_amount > ZERO:
            risk_mult = t.risk_amount / base_risk
        lot_mult = None
        if base_lot and base_lot > ZERO and t.lot_size > ZERO:
            lot_mult = t.lot_size / base_lot

        in_dd = in_drawdown_fn(t) if in_drawdown_fn else False

        is_revenge = False
        if prev_outcome == "loss":
            rapid = minutes is not None and minutes <= REVENGE_MINUTES_THRESHOLD
            risk_up = risk_mult is not None and risk_mult >= REVENGE_RISK_MULTIPLIER
            lot_up = lot_mult is not None and lot_mult >= REVENGE_LOT_MULTIPLIER
            emotional = t.emotional_trade or t.revenge_intensity >= 5 or t.emotion_before in {"revenge", "frustrated"}
            is_revenge = rapid or risk_up or lot_up or emotional

        is_rapid = minutes is not None and minutes <= REVENGE_MINUTES_THRESHOLD

        contexts.append(
            TradeContext(
                trade=t,
                prev_outcome=prev_outcome,
                consecutive_losses_before=consec_l,
                consecutive_wins_before=consec_w,
                minutes_since_prev=minutes,
                risk_multiplier_vs_baseline=risk_mult,
                lot_multiplier_vs_baseline=lot_mult,
                in_drawdown=in_dd,
                is_revenge_candidate=is_revenge,
                is_rapid_followup=is_rapid,
            )
        )

        outcome = t.classify_outcome()
        if outcome == "loss":
            consec_l += 1
            consec_w = 0
        elif outcome == "win":
            consec_w += 1
            consec_l = 0
        else:
            consec_l = 0
            consec_w = 0

    return contexts
