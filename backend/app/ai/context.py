"""Structured AI context. No raw table dumps, no other users/accounts."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.ai.evidence import build_comparable_report, candidate_patterns, prior_trades
from app.ai.guardrails.confidence import classify_confidence, confidence_reason
from app.ai.period import PeriodSpec, resolve_period, slice_trades
from app.ai.serialize import to_jsonable
from app.core.time import as_utc, utcnow
from app.engines.fx_math import ZERO
from app.engines.performance_engine import compute_performance
from app.models.account import Account
from app.models.checklist import TradeChecklistResponse
from app.models.trade import Trade
from app.models.user import User
from app.services.access import get_owned_account
from app.services.analytics_service import (
    by_direction,
    by_psychology,
    by_session,
    by_setup,
    by_weekday,
)
from app.services.mapping import profile_view, trade_to_closed
from app.services.serializers import serialize_trade
from app.engines.risk_engine import compute_risk_snapshot


def load_account_trades(db: Session, user_id: UUID, account_id: UUID) -> list[Trade]:
    return (
        db.query(Trade)
        .options(
            joinedload(Trade.psychology),
            joinedload(Trade.setup),
            joinedload(Trade.checklist_responses).joinedload(TradeChecklistResponse.item),
        )
        .filter(Trade.account_id == account_id, Trade.user_id == user_id)
        .order_by(Trade.trade_timestamp.asc())
        .all()
    )


def _perf(trades: list[Trade], starting: Decimal) -> dict:
    m = compute_performance([trade_to_closed(t) for t in trades], starting)
    return {
        "n": m.n_trades,
        "expectancy_r": m.expectancy_r,
        "win_rate": m.win_rate,
        "profit_factor": m.profit_factor,
        "average_r": m.average_r,
        "net_pnl": m.net_pnl,
        "sample_note": m.sample_note,
        "evidence_confidence": classify_confidence(m.n_trades).value,
    }


def account_context(account: Account, user: User, snap) -> dict:
    rp = account.risk_profile
    return {
        "firm": account.firm,
        "program": account.program,
        "name": account.account_name,
        "currency": account.currency,
        "balance": snap.current_balance,
        "equity": snap.current_equity,
        "drawdown": snap.current_drawdown,
        "daily_pnl": snap.daily_pnl,
        "trades_today": snap.trades_today,
        "consecutive_losses": snap.consecutive_losses,
        "consecutive_wins": snap.consecutive_wins,
        "risk_status": {"status": snap.status.value, "reasons": snap.reasons},
        "risk_policy": {
            "risk_per_trade": rp.risk_per_trade if rp else None,
            "personal_daily_loss": rp.personal_daily_loss_limit if rp else None,
            "personal_max_drawdown": rp.personal_max_drawdown if rp else None,
            "firm_daily_drawdown": rp.firm_daily_drawdown_limit if rp else None,
            "firm_max_drawdown": rp.firm_max_drawdown_limit if rp else None,
            "max_trades_per_day": rp.max_trades_per_day if rp else None,
            "preferred_min_rr": rp.preferred_min_rr if rp else None,
        },
        "timezone": user.timezone,
    }


def snapshot_for(account: Account, user: User, trades: list[Trade]):
    return compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile_view(account.risk_profile),
        trades=[trade_to_closed(t) for t in trades],
        now=utcnow(),
        timezone=user.timezone,
    )


def trade_payload(trade: Trade) -> dict:
    ser = serialize_trade(trade)
    return ser.model_dump(mode="json")


def behavioral_stats(trades: list[Trade]) -> dict:
    closed = [t for t in trades if t.status == "closed"]
    closed_sorted = sorted(closed, key=lambda t: as_utc(t.exit_timestamp or t.trade_timestamp))
    after_loss: list[Decimal] = []
    after_win: list[Decimal] = []
    after_two_losses = 0
    consec = 0
    for i, t in enumerate(closed_sorted):
        if i > 0:
            prev = closed_sorted[i - 1]
            if prev.result == "loss":
                after_loss.append(Decimal(t.risk_amount))
            if prev.result == "win":
                after_win.append(Decimal(t.risk_amount))
            if consec >= 2:
                after_two_losses += 1
        if t.result == "loss":
            consec += 1
        else:
            consec = 0
    def avg(xs: list[Decimal]) -> Decimal | None:
        if not xs:
            return None
        return sum(xs, ZERO) / Decimal(len(xs))

    fomo_n = sum(1 for t in closed if t.psychology and (t.psychology.fomo >= 5 or t.psychology.emotion_before == "fomo"))
    revenge_n = sum(1 for t in closed if t.emotional_trade or (t.psychology and t.psychology.revenge >= 5))
    outside = sum(1 for t in closed if not t.in_preferred_session)
    return {
        "n_closed": len(closed),
        "avg_risk_after_loss": avg(after_loss),
        "avg_risk_after_win": avg(after_win),
        "avg_risk_after_loss_n": len(after_loss),
        "avg_risk_after_win_n": len(after_win),
        "trades_after_two_plus_losses": after_two_losses,
        "fomo_or_high_fomo_count": fomo_n,
        "revenge_or_emotional_count": revenge_n,
        "outside_preferred_session_count": outside,
    }


def build_trade_review_context(
    db: Session, user: User, trade: Trade
) -> dict:
    account = get_owned_account(db, user.id, trade.account_id)
    trades = load_account_trades(db, user.id, account.id)
    snap = snapshot_for(account, user, trades)
    report = build_comparable_report(trade, trades, Decimal(account.starting_balance))
    setup_name = trade.setup.name if trade.setup else None
    similar_setup = [t for t in prior_trades(trades, trade.exit_timestamp or trade.trade_timestamp) if t.setup_id == trade.setup_id]
    similar_session = [t for t in prior_trades(trades, trade.exit_timestamp or trade.trade_timestamp) if t.session == trade.session]
    return to_jsonable(
        {
            "user": {"timezone": user.timezone},
            "account": account_context(account, user, snap),
            "current_trade": trade_payload(trade),
            "historical_at_the_time": {
                "note": "Comparable trades are strictly before this trade's exit/entry. No look-ahead.",
                "comparable_trades": report.n,
                "expectancy_r": report.expectancy_r,
                "win_rate": report.win_rate,
                "profit_factor": report.profit_factor,
                "evidence_confidence": report.confidence.value,
                "confidence_reason": report.reason,
                "similar_setup_count": len(similar_setup),
                "similar_setup": _perf(similar_setup, Decimal(account.starting_balance)),
                "similar_session": _perf(similar_session, Decimal(account.starting_balance)),
                "by_psychology_among_comparables": report.by_psychology,
            },
            "discipline_score_deterministic": trade.discipline_score,
            "setup_name": setup_name,
        }
    )


def _buckets(trades: list[Trade], starting: Decimal, key_fn) -> list[dict]:
    grouped: dict[str, list[Trade]] = {}
    for t in trades:
        grouped.setdefault(str(key_fn(t)), []).append(t)
    out = []
    for key, items in sorted(grouped.items(), key=lambda kv: -len(kv[1])):
        out.append({"key": key, **_perf(items, starting)})
    return out


def _period_payload(spec: PeriodSpec) -> dict:
    return {
        "preset": spec.preset,
        "kind": spec.kind,
        "label": spec.label,
        "last_n": spec.last_n,
        "start": spec.start.isoformat() if spec.start else None,
        "end": spec.end.isoformat() if spec.end else None,
        "previous_start": spec.prev_start.isoformat() if spec.prev_start else None,
        "previous_end": spec.prev_end.isoformat() if spec.prev_end else None,
        "note": "Trades outside this window are excluded from selected stats. Lifetime overall is background only.",
    }


def build_period_context(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str,
    start: str | None = None,
    end: str | None = None,
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    trades = load_account_trades(db, user.id, account.id)
    snap = snapshot_for(account, user, trades)
    starting = Decimal(account.starting_balance)
    spec = resolve_period(preset, timezone=user.timezone, start=start, end=end)
    selected, previous = slice_trades(trades, spec)
    selected_perf = _perf(selected, starting)
    return to_jsonable(
        {
            "user": {"timezone": user.timezone},
            "account": account_context(account, user, snap),
            "period": _period_payload(spec),
            "selected": selected_perf,
            "previous": _perf(previous, starting),
            "overall": _perf(trades, starting),
            "by_session": _buckets(selected, starting, lambda t: t.session),
            "by_setup": _buckets(selected, starting, lambda t: t.setup.name if t.setup else "unclassified"),
            "by_direction": _buckets(selected, starting, lambda t: t.direction),
            "by_psychology": _buckets(
                selected,
                starting,
                lambda t: t.psychology.emotion_before if t.psychology else "unknown",
            ),
            "behavior": behavioral_stats(selected),
            "confidence_reason": confidence_reason(int(selected_perf["n"]), classify_confidence(int(selected_perf["n"]))),
        }
    )


def period_preview(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str,
    start: str | None = None,
    end: str | None = None,
) -> dict:
    """Deterministic window counts. Does not call an LLM."""
    ctx = build_period_context(db, user, account_id, preset=preset, start=start, end=end)
    selected = ctx.get("selected") or {}
    previous = ctx.get("previous") or {}
    n = int(selected.get("n") or 0)
    return {
        "period": ctx.get("period"),
        "n": n,
        "previous_n": int(previous.get("n") or 0),
        "expectancy_r": selected.get("expectancy_r"),
        "evidence_confidence": selected.get("evidence_confidence"),
        "confidence_reason": ctx.get("confidence_reason"),
        "sample_note": selected.get("sample_note"),
    }


def build_account_analytics_context(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    last_n: int = 30,
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    trades = load_account_trades(db, user.id, account.id)
    snap = snapshot_for(account, user, trades)
    starting = Decimal(account.starting_balance)
    recent = trades[-last_n:]
    tz = ZoneInfo(user.timezone)
    now = utcnow().astimezone(tz)
    week_ago = now - timedelta(days=7)
    two_weeks = now - timedelta(days=14)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    def in_range(ts, start, end=None):
        local = as_utc(ts).astimezone(tz)
        if end is None:
            return local >= start
        return start <= local < end

    this_week = [t for t in trades if in_range(t.trade_timestamp, week_ago)]
    prev_week = [t for t in trades if in_range(t.trade_timestamp, two_weeks, week_ago)]
    this_month = [t for t in trades if in_range(t.trade_timestamp, month_start)]
    prev_month = [t for t in trades if in_range(t.trade_timestamp, prev_month_start, month_start)]

    from app.engines.analytics_lab.intelligence import intelligence_ai_summary
    from app.engines.analytics_lab.trade_row import trade_to_analytics
    from app.engines.quant_lab.quant_intelligence import quant_ai_summary

    profile = account.risk_profile
    intel_rows = [trade_to_analytics(t) for t in trades]
    intelligence = intelligence_ai_summary(
        intel_rows,
        starting=starting,
        configured_risk=Decimal(profile.risk_per_trade) if profile else None,
    )
    quant_lab = quant_ai_summary(
        intel_rows,
        starting=starting,
        configured_risk=Decimal(profile.risk_per_trade) if profile else None,
    )

    return to_jsonable(
        {
            "user": {"timezone": user.timezone},
            "account": account_context(account, user, snap),
            "overall": _perf(trades, starting),
            "last_n": {"n_requested": last_n, **_perf(recent, starting)},
            "this_week": _perf(this_week, starting),
            "previous_week": _perf(prev_week, starting),
            "this_month": _perf(this_month, starting),
            "previous_month": _perf(prev_month, starting),
            "rolling_30": _perf(trades[-30:], starting),
            "rolling_100": _perf(trades[-100:], starting),
            "by_session": by_session(db, user, account.id),
            "by_setup": by_setup(db, user, account.id),
            "by_direction": by_direction(db, user, account.id),
            "by_weekday": by_weekday(db, user, account.id),
            "by_psychology": by_psychology(db, user, account.id),
            "behavior": behavioral_stats(trades),
            "intelligence_lab": intelligence,
            "quant_lab": quant_lab,
            "candidate_patterns": candidate_patterns(trades, starting),
        }
    )
