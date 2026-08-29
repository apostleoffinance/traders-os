"""Deterministic trade replay — separates decision quality from outcome."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.core.enums import Direction, SessionName, TradeResult, TradeStatus
from app.core.time import as_utc
from app.engines.fx_math import ZERO, money, ratio
from app.engines.process_checks import SESSION_DISPLAY
from app.engines.risk_engine import RiskProfileView
from app.models.trade import Trade


def _session_label(session: str) -> str:
    return SESSION_DISPLAY.get(session, session.replace("_", " ").title())


def _insight(tone: str, text: str, *, detail: str | None = None) -> dict[str, str | None]:
    return {"tone": tone, "text": text, "detail": detail}


def _checklist_summary(trade: Trade) -> tuple[int, int, int]:
    checked = 0
    total = 0
    required_miss = 0
    for resp in trade.checklist_responses:
        total += 1
        if resp.checked:
            checked += 1
        elif resp.item is not None and resp.item.required:
            required_miss += 1
    return checked, total, required_miss


def _near(price_a: Decimal, price_b: Decimal, tolerance_pct: Decimal = Decimal("0.15")) -> bool:
    if price_a <= ZERO or price_b <= ZERO:
        return False
    diff = abs(price_a - price_b)
    span = max(abs(price_a), abs(price_b))
    return diff <= span * tolerance_pct


def _price_path(trade: Trade) -> dict[str, Any]:
    entry = trade.entry_price
    sl = trade.stop_loss
    tp = trade.take_profit
    exit_p = trade.exit_price
    is_long = trade.direction == Direction.LONG.value

    prices = [entry, sl]
    if tp is not None:
        prices.append(tp)
    if exit_p is not None:
        prices.append(exit_p)
    lo = min(prices)
    hi = max(prices)
    span = hi - lo if hi > lo else Decimal("0.0001")

    def y(price: Decimal | None) -> float | None:
        if price is None:
            return None
        return round(float((price - lo) / span), 4)

    favorable = None
    if exit_p is not None:
        if is_long:
            favorable = exit_p > entry
        else:
            favorable = exit_p < entry

    return {
        "entry_y": y(entry),
        "stop_y": y(sl),
        "target_y": y(tp),
        "exit_y": y(exit_p),
        "favorable": favorable,
        "direction": trade.direction,
    }


def _at_entry_insights(trade: Trade, profile: RiskProfileView | None) -> list[dict[str, str | None]]:
    insights: list[dict[str, str | None]] = []
    session = _session_label(trade.session)

    if trade.session == SessionName.OUTSIDE.value:
        insights.append(_insight("warn", "Outside your defined trading sessions"))
    elif trade.in_preferred_session:
        insights.append(_insight("ok", f"{session} session — in your preferred window"))
    else:
        insights.append(_insight("warn", f"{session} session — outside preferred window"))

    if trade.setup and trade.setup.name:
        if trade.setup_valid:
            insights.append(_insight("ok", f"Setup: {trade.setup.name}"))
        else:
            insights.append(_insight("bad", f"Setup marked invalid ({trade.setup.name})"))
    elif trade.setup_valid:
        insights.append(_insight("ok", "Setup criteria marked valid"))
    else:
        insights.append(_insight("warn", "No setup classified or marked invalid"))

    checked, total, required_miss = _checklist_summary(trade)
    if total == 0:
        insights.append(_insight("neutral", "No checklist recorded for this trade"))
    elif required_miss > 0:
        insights.append(_insight("warn", f"Checklist incomplete — {checked}/{total} items checked"))
    else:
        insights.append(_insight("ok", f"Checklist complete ({checked}/{total})"))

    if profile is not None:
        if trade.risk_amount <= profile.risk_per_trade:
            insights.append(
                _insight(
                    "ok",
                    f"Risk within policy (${money(trade.risk_amount)} / ${money(profile.risk_per_trade)})",
                )
            )
        else:
            insights.append(
                _insight(
                    "warn",
                    f"Risk above configured unit (${money(trade.risk_amount)} vs ${money(profile.risk_per_trade)})",
                )
            )
        if trade.planned_rr is not None:
            if trade.planned_rr >= profile.preferred_min_rr:
                insights.append(_insight("ok", f"Planned R:R 1:{ratio(trade.planned_rr)} meets minimum"))
            else:
                insights.append(
                    _insight(
                        "warn",
                        f"Planned R:R 1:{ratio(trade.planned_rr)} below minimum 1:{ratio(profile.preferred_min_rr)}",
                    )
                )
    elif trade.planned_rr is not None:
        insights.append(_insight("ok", f"Planned R:R 1:{ratio(trade.planned_rr)}"))

    if trade.psychology:
        conf = trade.psychology.confidence
        emotion = trade.psychology.emotion_before.replace("_", " ")
        if conf >= 7:
            insights.append(_insight("ok", f"Confidence {conf}/10 — {emotion} before entry"))
        elif conf >= 4:
            insights.append(_insight("neutral", f"Confidence {conf}/10 — {emotion} before entry"))
        else:
            insights.append(_insight("warn", f"Low confidence ({conf}/10) — {emotion} before entry"))
        if trade.psychology.fomo >= 7:
            insights.append(_insight("warn", "High FOMO flagged before entry"))
        if trade.psychology.revenge >= 7:
            insights.append(_insight("bad", "Revenge mindset flagged before entry"))

    if trade.rules_followed:
        insights.append(_insight("ok", "Trading rules marked as followed"))
    else:
        insights.append(_insight("bad", "Trading rules not followed at entry"))

    return insights


def _after_insights(trade: Trade) -> list[dict[str, str | None]]:
    if trade.status != TradeStatus.CLOSED.value or trade.exit_price is None:
        return []

    insights: list[dict[str, str | None]] = []
    is_long = trade.direction == Direction.LONG.value
    moved_favorably = (trade.exit_price > trade.entry_price) if is_long else (trade.exit_price < trade.entry_price)

    if trade.result == TradeResult.WIN.value:
        insights.append(_insight("ok", "Price moved in your direction — winning trade"))
    elif trade.result == TradeResult.LOSS.value:
        insights.append(_insight("warn", "Price moved against you — losing trade"))
    elif trade.result == TradeResult.BREAKEVEN.value:
        insights.append(_insight("neutral", "Trade closed near breakeven"))
    elif moved_favorably:
        insights.append(_insight("ok", "Exit was in the favorable direction"))
    else:
        insights.append(_insight("warn", "Exit was against the initial bias"))

    if trade.planned_rr is not None and trade.realized_r is not None:
        planned = trade.planned_rr
        realized = trade.realized_r
        if realized >= planned * Decimal("0.9"):
            insights.append(_insight("ok", f"Reached planned target ({ratio(realized)}R of {ratio(planned)}R)"))
        elif realized > ZERO and realized < planned * Decimal("0.85"):
            pct = int((1 - realized / planned) * 100) if planned > ZERO else 0
            insights.append(
                _insight(
                    "warn",
                    f"You closed ~{max(0, pct)}% before full target",
                    detail=f"{ratio(realized)}R realized vs {ratio(planned)}R planned",
                )
            )

    if trade.take_profit is not None and _near(trade.exit_price, trade.take_profit):
        insights.append(_insight("ok", "Exit near take-profit level"))
    elif _near(trade.exit_price, trade.stop_loss):
        if trade.mistake:
            insights.append(_insight("bad", "Stopped out — mistake flagged on this trade"))
        else:
            insights.append(_insight("neutral", "Stopped out at planned stop level"))

    if trade.discipline_score is not None:
        if trade.discipline_score >= 80 and trade.result == TradeResult.LOSS.value:
            insights.append(_insight("ok", "Loss with strong discipline — process held"))
        elif trade.discipline_score < 60 and trade.result == TradeResult.WIN.value:
            insights.append(_insight("warn", "Win despite process gaps — don't confuse luck with edge"))
        elif trade.discipline_score >= 80:
            insights.append(_insight("ok", f"Discipline score {trade.discipline_score}/100"))

    if trade.psychology:
        if trade.psychology.emotion_after in {"frustrated", "anxious", "revenge"}:
            insights.append(
                _insight("warn", f"Emotion after exit: {trade.psychology.emotion_after.replace('_', ' ')}")
            )
        if trade.emotional_trade:
            insights.append(_insight("warn", "Trade marked as emotionally driven"))

    if trade.mistake and trade.mistake_notes:
        insights.append(_insight("bad", "Mistake noted", detail=trade.mistake_notes))

    return insights


def _context_cards(trade: Trade) -> dict[str, list[dict[str, str]]]:
    checked, total, _ = _checklist_summary(trade)
    pre: list[dict[str, str]] = [
        {"label": "Confidence", "value": f"{trade.psychology.confidence}/10" if trade.psychology else "—"},
        {
            "label": "Emotion",
            "value": trade.psychology.emotion_before.replace("_", " ") if trade.psychology else "—",
        },
        {"label": "Setup", "value": trade.setup.name if trade.setup else "—"},
    ]
    execution: list[dict[str, str]] = [
        {"label": "Risk", "value": f"{money(trade.risk_percent)}%"},
        {"label": "Checklist", "value": f"{checked}/{total}" if total else "—"},
        {"label": "Planned R:R", "value": f"1:{ratio(trade.planned_rr)}" if trade.planned_rr else "—"},
    ]
    post: list[dict[str, str]] = []
    if trade.status == TradeStatus.CLOSED.value:
        post = [
            {
                "label": "Result",
                "value": f"{ratio(trade.realized_r)}R" if trade.realized_r is not None else trade.result,
            },
            {"label": "P/L", "value": f"${money(trade.realized_pnl)}" if trade.realized_pnl is not None else "—"},
            {"label": "Discipline", "value": f"{trade.discipline_score}/100" if trade.discipline_score is not None else "—"},
        ]
    return {"pre_trade": pre, "execution": execution, "post_trade": post}


def _timeline(trade: Trade, timezone: str) -> list[dict[str, Any]]:
    from zoneinfo import ZoneInfo

    events: list[dict[str, Any]] = []
    entry_at = as_utc(trade.trade_timestamp).astimezone(ZoneInfo(timezone))
    events.append(
        {
            "phase": "entry",
            "at": entry_at.isoformat(),
            "label": "Entry",
            "price": str(trade.entry_price),
            "time_label": entry_at.strftime("%H:%M"),
        }
    )

    if trade.status == TradeStatus.OPEN.value:
        events.append(
            {
                "phase": "open",
                "label": "Position open",
                "detail": "Trade still running",
            }
        )
        return events

    if trade.exit_timestamp is not None:
        exit_at = as_utc(trade.exit_timestamp).astimezone(ZoneInfo(timezone))
        if trade.holding_time_seconds:
            events.append(
                {
                    "phase": "hold",
                    "duration_seconds": trade.holding_time_seconds,
                    "label": "In trade",
                }
            )
        events.append(
            {
                "phase": "exit",
                "at": exit_at.isoformat(),
                "label": "Exit",
                "price": str(trade.exit_price) if trade.exit_price is not None else None,
                "time_label": exit_at.strftime("%H:%M"),
            }
        )
    return events


def _decision_quality(trade: Trade) -> dict[str, Any]:
    at_entry = _at_entry_insights(trade, None)
    ok = sum(1 for i in at_entry if i["tone"] == "ok")
    bad = sum(1 for i in at_entry if i["tone"] in {"bad", "warn"})
    total = len(at_entry) or 1
    process_score = int(round(ok / total * 100))
    if trade.discipline_score is not None:
        process_score = trade.discipline_score

    return {
        "process_score": process_score,
        "outcome_r": str(trade.realized_r) if trade.realized_r is not None else None,
        "outcome_label": trade.result if trade.status == TradeStatus.CLOSED.value else "open",
        "headline": (
            "Strong process, tough outcome"
            if process_score >= 75 and trade.result == TradeResult.LOSS.value
            else "Process gaps masked by profit"
            if process_score < 60 and trade.result == TradeResult.WIN.value
            else "Process and outcome aligned"
            if trade.result == TradeResult.WIN.value and process_score >= 70
            else "Review decision inputs"
        ),
    }


def build_trade_replay(trade: Trade, *, profile: RiskProfileView | None, timezone: str) -> dict[str, Any]:
    at_entry = _at_entry_insights(trade, profile)
    after = _after_insights(trade)
    quality = _decision_quality(trade)
    if profile is not None:
        quality["process_score"] = trade.discipline_score if trade.discipline_score is not None else quality["process_score"]

    return {
        "trade_id": str(trade.id),
        "symbol": trade.symbol,
        "direction": trade.direction,
        "status": trade.status,
        "timeframe": trade.timeframe,
        "session": trade.session,
        "timeline": _timeline(trade, timezone),
        "price_path": _price_path(trade),
        "levels": {
            "entry": str(trade.entry_price),
            "stop_loss": str(trade.stop_loss),
            "take_profit": str(trade.take_profit) if trade.take_profit is not None else None,
            "exit": str(trade.exit_price) if trade.exit_price is not None else None,
        },
        "context": _context_cards(trade),
        "decision_replay": {
            "at_entry": at_entry,
            "after": after,
        },
        "decision_quality": quality,
    }
