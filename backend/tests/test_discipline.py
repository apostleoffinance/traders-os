from decimal import Decimal

from app.core.enums import SessionName
from app.engines.discipline_engine import TradeDisciplineInput, score_trade


def _base(**kwargs) -> TradeDisciplineInput:
    data = dict(
        planned_risk=Decimal("5.00"),
        risk_limit=Decimal("5.00"),
        setup_valid=True,
        rules_followed=True,
        stop_loss_set=True,
        take_profit_set=True,
        planned_rr=Decimal("2.00"),
        preferred_min_rr=Decimal("1.50"),
        session=SessionName.LONDON,
        in_preferred_session=True,
        checklist_checked=11,
        checklist_total=11,
        emotional_trade=False,
        revenge=False,
        mistake=False,
        trades_today_including_this=1,
        max_trades_per_day=2,
    )
    data.update(kwargs)
    return TradeDisciplineInput(**data)


def test_losing_rules_followed_trade_scores_high() -> None:
    score = score_trade(_base())
    assert score.total >= 90


def test_winning_revenge_trade_scores_low() -> None:
    score = score_trade(
        _base(
            setup_valid=False,
            rules_followed=False,
            emotional_trade=True,
            revenge=True,
            planned_risk=Decimal("12.00"),
            in_preferred_session=False,
            checklist_checked=2,
            checklist_total=11,
        )
    )
    assert score.total < 40


def test_independent_of_pnl() -> None:
    # discipline engine does not take pnl as an input
    a = score_trade(_base())
    b = score_trade(_base())
    assert a.total == b.total
