from __future__ import annotations

from datetime import time
from decimal import Decimal

from app.core.enums import Emotion, TradeResult, TradeStatus
from app.engines.analytics_views import JournalTrade
from app.engines.psychology_engine import PsychTrade
from app.engines.risk_engine import ClosedTrade, RiskProfileView
from app.engines.session_engine import PreferredWindow
from app.models.account import AccountRiskProfile
from app.models.trade import Trade


def parse_windows(raw: list | dict | None) -> list[PreferredWindow]:
    if not raw:
        from app.services.defaults import DEFAULT_PREFERRED_WINDOWS

        raw = DEFAULT_PREFERRED_WINDOWS
    windows: list[PreferredWindow] = []
    for item in raw:
        start_h, start_m = (item.get("start") or "00:00").split(":")[:2]
        end_h, end_m = (item.get("end") or "00:00").split(":")[:2]
        windows.append(
            PreferredWindow(
                name=item.get("name", "window"),
                timezone=item.get("timezone", "Africa/Lagos"),
                start=time(int(start_h), int(start_m)),
                end=time(int(end_h), int(end_m)),
            )
        )
    return windows


def profile_view(profile: AccountRiskProfile) -> RiskProfileView:
    return RiskProfileView(
        risk_per_trade=Decimal(profile.risk_per_trade),
        personal_daily_loss_limit=Decimal(profile.personal_daily_loss_limit),
        personal_max_drawdown=Decimal(profile.personal_max_drawdown),
        firm_daily_drawdown_limit=Decimal(profile.firm_daily_drawdown_limit),
        firm_max_drawdown_limit=Decimal(profile.firm_max_drawdown_limit),
        max_trades_per_day=profile.max_trades_per_day,
        preferred_min_rr=Decimal(profile.preferred_min_rr),
        hard_risk_per_trade=Decimal(profile.hard_risk_per_trade)
        if profile.hard_risk_per_trade is not None
        else None,
    )


def trade_to_closed(trade: Trade) -> ClosedTrade:
    revenge = False
    if trade.psychology is not None:
        revenge = trade.psychology.revenge >= 5 or trade.psychology.emotion_before == "revenge"
    return ClosedTrade(
        id=str(trade.id),
        entry_at=trade.trade_timestamp,
        exit_at=trade.exit_timestamp,
        risk_amount=Decimal(trade.risk_amount or 0),
        realized_pnl=Decimal(trade.realized_pnl or 0),
        result=TradeResult(trade.result),
        status=TradeStatus(trade.status),
        revenge=revenge,
        emotional=trade.emotional_trade,
        outside_preferred_session=not trade.in_preferred_session,
    )


def trade_to_journal(trade: Trade) -> JournalTrade:
    return JournalTrade(
        id=str(trade.id),
        symbol=trade.symbol,
        session=trade.session,
        setup=trade.setup.name if trade.setup else "unclassified",
        direction=trade.direction,
        timeframe=trade.timeframe,
        result=TradeResult(trade.result),
        status=TradeStatus(trade.status),
        entry_at=trade.trade_timestamp,
        exit_at=trade.exit_timestamp,
        risk_amount=Decimal(trade.risk_amount or 0),
        risk_percent=Decimal(trade.risk_percent or 0),
        realized_pnl=Decimal(trade.realized_pnl or 0),
        realized_r=Decimal(trade.realized_r) if trade.realized_r is not None else None,
        holding_time_seconds=trade.holding_time_seconds,
        emotion_before=trade.psychology.emotion_before if trade.psychology else None,
        discipline_score=trade.discipline_score,
    )


def trade_to_psych(trade: Trade) -> PsychTrade:
    base = trade_to_closed(trade)
    psy = trade.psychology
    return PsychTrade(
        **base.__dict__,
        emotion_before=Emotion(psy.emotion_before) if psy else None,
        emotion_during=Emotion(psy.emotion_during) if psy else None,
        emotion_after=Emotion(psy.emotion_after) if psy else None,
        fomo=psy.fomo if psy else 0,
        fear=psy.fear if psy else 0,
        frustration=psy.frustration if psy else 0,
        revenge_intensity=psy.revenge if psy else 0,
        boredom=psy.boredom if psy else 0,
        confidence=psy.confidence if psy else 0,
    )
