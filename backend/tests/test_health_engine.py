from decimal import Decimal

from app.core.enums import RiskStatus
from app.engines.health_engine import (
    MIN_TRADES_FOR_HEALTH,
    STATUS_INSUFFICIENT,
    STATUS_SCORED,
    HealthInputs,
    compute_health,
)


def _inputs(n: int, **overrides) -> HealthInputs:
    base = dict(
        n_trades=n,
        risk_status=RiskStatus.GREEN,
        discipline_score=None,
        emotional_stability=None,
        trades_today=0,
        max_trades_per_day=2,
        current_drawdown=Decimal("0"),
        personal_max_drawdown=Decimal("50"),
        consecutive_losses=0,
    )
    base.update(overrides)
    return HealthInputs(**base)


def test_zero_trades_does_not_invent_a_health_score() -> None:
    report = compute_health(_inputs(0))
    assert report.status == STATUS_INSUFFICIENT
    assert report.score is None
    assert report.trades_needed == MIN_TRADES_FOR_HEALTH
    assert report.components == {}


def test_below_threshold_still_refuses() -> None:
    report = compute_health(_inputs(MIN_TRADES_FOR_HEALTH - 1))
    assert report.status == STATUS_INSUFFICIENT
    assert report.score is None
    assert report.trades_needed == 1


def test_threshold_trades_returns_scored_int() -> None:
    report = compute_health(
        _inputs(
            MIN_TRADES_FOR_HEALTH,
            discipline_score=80,
            emotional_stability=75,
        )
    )
    assert report.status == STATUS_SCORED
    assert report.trades_needed == 0
    assert isinstance(report.score, int)
    assert 0 <= report.score <= 100
