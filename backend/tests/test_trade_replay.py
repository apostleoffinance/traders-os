"""Unit tests for trade replay engine."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.core.enums import TradeResult, TradeStatus
from app.engines.risk_engine import RiskProfileView
from app.engines.trade_replay import build_trade_replay


def _trade(**kwargs):
    base = dict(
        id=uuid4(),
        symbol="EURUSD",
        direction="long",
        trade_timestamp=datetime(2026, 3, 10, 8, 30, tzinfo=timezone.utc),
        exit_timestamp=datetime(2026, 3, 10, 10, 46, tzinfo=timezone.utc),
        timezone="UTC",
        session="london",
        in_preferred_session=True,
        timeframe="M15",
        entry_price=Decimal("1.08500"),
        exit_price=Decimal("1.08770"),
        stop_loss=Decimal("1.08400"),
        take_profit=Decimal("1.08800"),
        lot_size=Decimal("0.10"),
        risk_amount=Decimal("8.00"),
        risk_percent=Decimal("0.80"),
        planned_rr=Decimal("3.0"),
        realized_pnl=Decimal("27.00"),
        realized_r=Decimal("1.8"),
        result=TradeResult.WIN.value,
        status=TradeStatus.CLOSED.value,
        holding_time_seconds=8160,
        setup_valid=True,
        rules_followed=True,
        emotional_trade=False,
        mistake=False,
        discipline_score=94,
        setup=SimpleNamespace(name="Liquidity Sweep"),
        setup_name="Liquidity Sweep",
        psychology=SimpleNamespace(
            confidence=8,
            emotion_before="calm",
            emotion_after="satisfied",
            fomo=1,
            revenge=0,
        ),
        checklist_responses=[
            SimpleNamespace(checked=True, item=SimpleNamespace(required=True)),
        ]
        * 9
        + [SimpleNamespace(checked=False, item=SimpleNamespace(required=False))],
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_replay_winning_trade_has_entry_and_after_insights():
    profile = RiskProfileView(
        risk_per_trade=Decimal("10"),
        personal_daily_loss_limit=Decimal("50"),
        personal_max_drawdown=Decimal("100"),
        firm_daily_drawdown_limit=Decimal("60"),
        firm_max_drawdown_limit=Decimal("90"),
        max_trades_per_day=3,
        preferred_min_rr=Decimal("1.5"),
    )
    out = build_trade_replay(_trade(), profile=profile, timezone="UTC")
    assert out["symbol"] == "EURUSD"
    assert len(out["timeline"]) == 3
    assert out["timeline"][0]["phase"] == "entry"
    assert out["timeline"][-1]["phase"] == "exit"
    assert any("London" in i["text"] for i in out["decision_replay"]["at_entry"])
    assert any("direction" in i["text"].lower() for i in out["decision_replay"]["after"])
    assert out["decision_quality"]["process_score"] == 94


def test_replay_open_trade_skips_after_insights():
    t = _trade(status=TradeStatus.OPEN.value, exit_timestamp=None, exit_price=None, result=TradeResult.OPEN.value)
    out = build_trade_replay(t, profile=None, timezone="UTC")
    assert out["decision_replay"]["after"] == []
    assert out["timeline"][-1]["phase"] == "open"
    assert out["context"]["post_trade"] == []


def test_replay_early_exit_warning():
    t = _trade(realized_r=Decimal("1.0"), planned_rr=Decimal("3.0"))
    out = build_trade_replay(t, profile=None, timezone="UTC")
    assert any("before full target" in i["text"] for i in out["decision_replay"]["after"])
