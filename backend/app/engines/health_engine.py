"""Trading-health score — distinct from P/L and from per-trade discipline.

Combines risk behavior, discipline, emotional stability, consistency,
and drawdown distance. Never rewards taking more trades.

Refuses to score until MIN_TRADES_FOR_HEALTH closed trades exist.
Empty sub-scores must not silently default into a phantom composite.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.core.enums import RiskStatus
from app.engines.fx_math import ZERO
from app.engines.performance_engine import MIN_INSIGHT_N

MIN_TRADES_FOR_HEALTH = MIN_INSIGHT_N  # same gate as grouped insights
STATUS_INSUFFICIENT = "insufficient_data"
STATUS_SCORED = "scored"


@dataclass
class HealthInputs:
    n_trades: int
    risk_status: RiskStatus
    discipline_score: int | None
    emotional_stability: int | None
    trades_today: int
    max_trades_per_day: int
    current_drawdown: Decimal
    personal_max_drawdown: Decimal
    consecutive_losses: int


@dataclass
class HealthReport:
    score: int | None
    status: str
    trades_needed: int
    components: dict[str, int]
    summary: str


def _status_score(status: RiskStatus) -> int:
    return {RiskStatus.GREEN: 100, RiskStatus.YELLOW: 55, RiskStatus.RED: 15}[status]


def compute_health(inp: HealthInputs) -> HealthReport:
    n = max(0, inp.n_trades)
    if n < MIN_TRADES_FOR_HEALTH:
        needed = MIN_TRADES_FOR_HEALTH - n
        return HealthReport(
            score=None,
            status=STATUS_INSUFFICIENT,
            trades_needed=needed,
            components={},
            summary=f"{needed} more trade{'s' if needed != 1 else ''} needed to score trading health.",
        )

    risk = _status_score(inp.risk_status)
    discipline = inp.discipline_score if inp.discipline_score is not None else 70
    emotion = inp.emotional_stability if inp.emotional_stability is not None else 70

    if inp.max_trades_per_day <= 0:
        frequency = 80
    elif inp.trades_today > inp.max_trades_per_day:
        frequency = 20
    elif inp.trades_today == inp.max_trades_per_day:
        frequency = 70  # at cap: adherent but no extra credit
    else:
        frequency = 100

    if inp.personal_max_drawdown <= ZERO:
        drawdown = 80
    else:
        used = float(inp.current_drawdown / inp.personal_max_drawdown)
        drawdown = int(max(0, min(100, round((1.0 - used) * 100))))

    if inp.consecutive_losses >= 5:
        consistency = 20
    elif inp.consecutive_losses >= 3:
        consistency = 50
    else:
        consistency = 90

    components = {
        "risk_behavior": risk,
        "discipline": discipline,
        "emotional_stability": emotion,
        "frequency": frequency,
        "drawdown": drawdown,
        "consistency": consistency,
    }
    score = int(
        round(
            risk * 0.30
            + discipline * 0.25
            + emotion * 0.15
            + frequency * 0.10
            + drawdown * 0.10
            + consistency * 0.10
        )
    )
    if inp.risk_status == RiskStatus.RED:
        summary = "Account risk is elevated. Stand down until limits reset."
    elif inp.risk_status == RiskStatus.YELLOW:
        summary = "Caution. Size down or skip if the next setup is not A-grade."
    elif score >= 85:
        summary = "Behavior is within policy. No trade is required."
    else:
        summary = "Health is adequate. Keep risk at the configured unit. No setup = no trade."
    return HealthReport(
        score=score,
        status=STATUS_SCORED,
        trades_needed=0,
        components=components,
        summary=summary,
    )
