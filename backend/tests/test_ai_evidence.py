from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.ai.evidence import prior_trades, similarity_score


def _t(i: int, *, days: int, session: str = "london", setup_id: str = "s1") -> SimpleNamespace:
    ts = datetime(2026, 3, 10, 10, 0, tzinfo=ZoneInfo("UTC")) + timedelta(days=days)
    return SimpleNamespace(
        id=str(i),
        symbol="EURUSD",
        session=session,
        setup_id=setup_id,
        direction="long",
        timeframe="M15",
        planned_rr=None,
        trade_timestamp=ts,
        exit_timestamp=ts + timedelta(hours=1),
        psychology=None,
        setup=None,
    )


def test_prior_trades_exclude_later_observations() -> None:
    older = _t(1, days=0)
    later = _t(2, days=2)
    as_of = datetime(2026, 3, 11, 12, 0, tzinfo=ZoneInfo("UTC"))
    prior = prior_trades([older, later], as_of)
    assert [p.id for p in prior] == ["1"]


def test_similarity_rewards_session_and_setup() -> None:
    a = _t(1, days=0, session="london")
    b = _t(2, days=-1, session="london")
    c = _t(3, days=-1, session="asia", setup_id="other")
    assert similarity_score(a, b) > similarity_score(a, c)
