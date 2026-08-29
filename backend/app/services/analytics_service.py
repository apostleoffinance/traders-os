from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import DomainError
from app.core.time import as_utc, utcnow
from app.engines.analytics_views import (
    after_consecutive_losses,
    calendar_days,
    consistency,
    drawdown_episodes,
    frequency_buckets,
    group_stats,
    holding_scatter,
    key_observations,
    monthly_bars,
    r_distribution,
    r_of,
    risk_scatter,
    rolling_expectancy,
    streak_histogram,
)
from app.engines.discipline_engine import aggregate_discipline
from app.engines.edge_explorer import edge_detail, edge_matrix, ranked_combos
from app.engines.evidence import evidence_payload
from app.engines.fx_math import ZERO
from app.engines.performance_engine import compute_performance, rr_bucket
from app.engines.psychology_engine import psychology_groups
from app.engines.risk_command import build_risk_command
from app.engines.risk_engine import compute_risk_snapshot
from app.models.trade import Trade
from app.models.user import User
from app.services.access import get_owned_account
from app.services.mapping import profile_view, trade_to_closed, trade_to_journal, trade_to_psych


def _trades(db: Session, user_id: UUID, account_id: UUID) -> list[Trade]:
    return (
        db.query(Trade)
        .options(joinedload(Trade.psychology), joinedload(Trade.setup))
        .filter(Trade.account_id == account_id, Trade.user_id == user_id)
        .all()
    )


def _dump_group(g) -> dict:
    return {
        "key": g.key,
        "n": g.n,
        "net_pnl": g.net_pnl,
        "expectancy_r": g.expectancy_r,
        "win_rate": g.win_rate,
        "average_r": g.average_r,
        "profit_factor": g.profit_factor,
        "insight": g.insight,
    }


def _dump_perf(p) -> dict:
    return {
        "n_trades": p.n_trades,
        "n_wins": p.n_wins,
        "n_losses": p.n_losses,
        "n_be": p.n_be,
        "win_rate": p.win_rate,
        "net_pnl": p.net_pnl,
        "gross_profit": p.gross_profit,
        "gross_loss": p.gross_loss,
        "average_win": p.average_win,
        "average_loss": p.average_loss,
        "expectancy_r": p.expectancy_r,
        "expectancy_currency": p.expectancy_currency,
        "profit_factor": p.profit_factor,
        "average_r": p.average_r,
        "average_win_r": p.average_win_r,
        "average_loss_r": p.average_loss_r,
        "max_drawdown": p.max_drawdown,
        "max_drawdown_pct": p.max_drawdown_pct,
        "recovery_factor": p.recovery_factor,
        "consecutive_losses": p.consecutive_losses,
        "consecutive_wins": p.consecutive_wins,
        "max_consecutive_losses": p.max_consecutive_losses,
        "max_consecutive_wins": p.max_consecutive_wins,
        "sharpe": p.sharpe,
        "sortino": p.sortino,
        "sharpe_note": p.sharpe_note.__dict__,
        "sortino_note": p.sortino_note.__dict__,
        "sample_note": p.sample_note,
    }


def overview(db: Session, user: User, account_id: UUID) -> dict:
    account = get_owned_account(db, user.id, account_id)
    trades = _trades(db, user.id, account_id)
    return _dump_perf(compute_performance([trade_to_closed(t) for t in trades], Decimal(account.starting_balance)))


def by_session(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(db, user, account_id, lambda t: t.session, "Session")


def _bucket_stats(db, user, account_id, key_fn, label: str) -> list[dict]:
    account = get_owned_account(db, user.id, account_id)
    trades = _trades(db, user.id, account_id)
    buckets: dict[str, list] = {}
    for t in trades:
        buckets.setdefault(str(key_fn(t)), []).append(trade_to_closed(t))
    from app.engines.performance_engine import MIN_INSIGHT_N, compute_performance as cp

    out = []
    for key, items in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        m = cp(items, Decimal(account.starting_balance))
        insight = f"n={m.n_trades} — insufficient for inference."
        if m.n_trades >= MIN_INSIGHT_N and m.expectancy_r is not None:
            insight = (
                f"{label} '{key}' expectancy {m.expectancy_r}R over {m.n_trades} trades. Descriptive only."
            )
        out.append(
            {
                "key": key,
                "n": m.n_trades,
                "net_pnl": m.net_pnl,
                "expectancy_r": m.expectancy_r,
                "win_rate": m.win_rate,
                "average_r": m.average_r,
                "profit_factor": m.profit_factor,
                "insight": insight,
            }
        )
    return out


def by_setup(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(
        db, user, account_id, lambda t: t.setup.name if t.setup else "unclassified", "Setup"
    )


def by_direction(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(db, user, account_id, lambda t: t.direction, "Direction")


def by_weekday(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(
        db,
        user,
        account_id,
        lambda t: t.trade_timestamp.strftime("%A"),
        "Weekday",
    )


def by_timeframe(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(db, user, account_id, lambda t: t.timeframe, "Timeframe")


def by_psychology(db: Session, user: User, account_id: UUID) -> list[dict]:
    account = get_owned_account(db, user.id, account_id)
    trades = _trades(db, user.id, account_id)
    groups = psychology_groups([trade_to_psych(t) for t in trades], Decimal(account.starting_balance))
    return [_dump_group(g) for g in groups]


def by_rr(db: Session, user: User, account_id: UUID) -> list[dict]:
    return _bucket_stats(
        db,
        user,
        account_id,
        lambda t: rr_bucket(t.planned_rr),
        "Planned R:R",
    )


def by_holding(db: Session, user: User, account_id: UUID) -> list[dict]:
    def bucket(t: Trade) -> str:
        s = t.holding_time_seconds
        if s is None:
            return "open/unknown"
        if s < 15 * 60:
            return "<15m"
        if s < 60 * 60:
            return "15m–1h"
        if s < 4 * 3600:
            return "1h–4h"
        return "4h+"

    return _bucket_stats(db, user, account_id, bucket, "Holding time")


def equity_curve(db: Session, user: User, account_id: UUID) -> list[dict]:
    account = get_owned_account(db, user.id, account_id)
    trades = _trades(db, user.id, account_id)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile_view(account.risk_profile),
        trades=[trade_to_closed(t) for t in trades],
        now=utcnow(),
        timezone=user.timezone,
    )
    return [
        {
            "at": p.at.isoformat(),
            "equity": p.equity,
            "peak": p.peak,
            "drawdown": p.drawdown,
            "drawdown_pct": p.drawdown_pct,
            "daily_pnl": p.daily_pnl,
            "cumulative_r": p.cumulative_r,
        }
        for p in snap.equity_curve
    ]


def risk_status(db: Session, user: User, account_id: UUID) -> dict:
    account = get_owned_account(db, user.id, account_id)
    trades = _trades(db, user.id, account_id)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile_view(account.risk_profile),
        trades=[trade_to_closed(t) for t in trades],
        now=utcnow(),
        timezone=user.timezone,
    )
    return {
        "status": snap.status.value,
        "reasons": snap.reasons,
        "daily_pnl": snap.daily_pnl,
        "daily_risk": snap.daily_risk,
        "trades_today": snap.trades_today,
        "consecutive_losses": snap.consecutive_losses,
        "consecutive_wins": snap.consecutive_wins,
        "current_drawdown": snap.current_drawdown,
        "current_drawdown_pct": snap.current_drawdown_pct,
        "max_drawdown": snap.max_drawdown,
        "avg_risk_last_n": snap.avg_risk_last_n,
        "risk_escalation_pct": snap.risk_escalation_pct,
        "distance_to_personal_daily_loss": snap.distance_to_personal_daily_loss,
        "distance_to_firm_daily_dd": snap.distance_to_firm_daily_dd,
        "distance_to_personal_max_dd": snap.distance_to_personal_max_dd,
        "distance_to_firm_max_dd": snap.distance_to_firm_max_dd,
        "events": [
            {
                "event_type": e.event_type.value,
                "severity": e.severity.value,
                "message": e.message,
                "metric_value": e.metric_value,
                "threshold_value": e.threshold_value,
            }
            for e in snap.events
        ],
    }


def risk_command(db: Session, user: User, account_id: UUID) -> dict:
    account = get_owned_account(db, user.id, account_id)
    if account.risk_profile is None:
        raise DomainError("Account has no risk profile configured")
    trades = _trades(db, user.id, account_id)
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile,
        trades=[trade_to_closed(t) for t in trades],
        now=utcnow(),
        timezone=user.timezone,
    )
    return build_risk_command(
        account=account,
        profile_model=account.risk_profile,
        profile=profile,
        snap=snap,
        starting=Decimal(account.starting_balance),
    )


def resolve_date_window(
    preset: str,
    date_from: str | None,
    date_to: str | None,
    timezone: str,
    now: datetime | None = None,
) -> tuple[datetime | None, datetime | None, str]:
    tz = ZoneInfo(timezone)
    now_local = (now or utcnow()).astimezone(tz)
    key = (preset or "all").lower()
    if key == "custom":
        def parse(value: str | None, *, end_of_day: bool = False) -> datetime | None:
            if not value:
                return None
            raw = value.strip()
            if len(raw) <= 10:
                dt = datetime.fromisoformat(raw).replace(tzinfo=tz)
            else:
                dt = datetime.fromisoformat(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=tz)
                else:
                    dt = dt.astimezone(tz)
            if end_of_day:
                dt = dt.replace(hour=23, minute=59, second=59)
            return dt

        return parse(date_from), parse(date_to, end_of_day=True), "custom"
    if key == "7d":
        return now_local - timedelta(days=7), now_local, "7d"
    if key == "today":
        start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now_local, "today"
    if key == "30d":
        return now_local - timedelta(days=30), now_local, "30d"
    if key == "90d":
        return now_local - timedelta(days=90), now_local, "90d"
    if key == "ytd":
        return now_local.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0), now_local, "ytd"
    return None, None, "all"


def _apply_filters(
    trades: list[Trade],
    *,
    timezone: str,
    date_from: datetime | None,
    date_to: datetime | None,
    symbol: str | None,
    session: str | None,
    setup_id: UUID | None,
    direction: str | None,
    timeframe: str | None,
    psychology: str | None,
    result: str | None,
) -> list[Trade]:
    tz = ZoneInfo(timezone)
    out = []
    for t in trades:
        local = as_utc(t.trade_timestamp).astimezone(tz)
        if date_from and local < date_from:
            continue
        if date_to and local > date_to:
            continue
        if symbol and t.symbol.upper() != symbol.upper():
            continue
        if session and t.session != session:
            continue
        if setup_id and t.setup_id != setup_id:
            continue
        if direction and t.direction != direction:
            continue
        if timeframe and t.timeframe != timeframe:
            continue
        if psychology:
            emo = t.psychology.emotion_before if t.psychology else None
            if emo != psychology:
                continue
        if result and t.result != result:
            continue
        out.append(t)
    return out


def _util(used: Decimal, limit: Decimal) -> dict:
    pct = None
    if limit > ZERO:
        pct = (used / limit * Decimal("100")).quantize(Decimal("0.01"))
    return {"used": used, "limit": limit, "pct": pct}


def dashboard(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    all_trades = _trades(db, user.id, account.id)
    start, end, resolved = resolve_date_window(preset, date_from, date_to, user.timezone)
    filtered = _apply_filters(
        all_trades,
        timezone=user.timezone,
        date_from=start,
        date_to=end,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )
    starting = Decimal(account.starting_balance)
    journals = [trade_to_journal(t) for t in filtered]
    closed_views = [trade_to_closed(t) for t in filtered]
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=starting,
        profile=profile,
        trades=closed_views,
        now=utcnow(),
        timezone=user.timezone,
    )
    perf = compute_performance(closed_views, starting)
    disc_scores = [t.discipline_score for t in filtered if t.discipline_score is not None]
    discipline = aggregate_discipline(disc_scores) if disc_scores else None
    avg_risk = None
    risks = [Decimal(t.risk_amount) for t in filtered if t.status == "closed"]
    if risks:
        avg_risk = sum(risks, ZERO) / Decimal(len(risks))

    sessions = group_stats(journals, starting, lambda t: t.session, "Session")
    setups = group_stats(journals, starting, lambda t: t.setup, "Setup")
    psych = group_stats(journals, starting, lambda t: t.emotion_before or "unknown", "Psychology")
    weekday = group_stats(journals, starting, lambda t: as_utc(t.entry_at).astimezone(ZoneInfo(user.timezone)).strftime("%A"), "Weekday")
    frequency = frequency_buckets(journals, starting, user.timezone)
    after_losses = after_consecutive_losses(journals, starting, 2)

    curve = [
        {
            "at": p.at.isoformat(),
            "equity": p.equity,
            "peak": p.peak,
            "drawdown": p.drawdown,
            "drawdown_pct": p.drawdown_pct,
            "daily_pnl": p.daily_pnl,
            "cumulative_r": p.cumulative_r,
        }
        for p in snap.equity_curve
    ]
    dd = snap.current_drawdown
    personal_daily_used = max(-snap.daily_pnl, ZERO) if snap.daily_pnl < ZERO else ZERO
    symbols = sorted({t.symbol for t in all_trades})
    setup_opts = sorted(
        { (str(t.setup_id), t.setup.name if t.setup else "unclassified") for t in all_trades if t.setup_id },
        key=lambda x: x[1],
    )

    return {
        "account": {
            "id": str(account.id),
            "name": account.account_name,
            "currency": account.currency,
            "firm": account.firm,
        },
        "filters": {
            "preset": resolved,
            "date_from": start.isoformat() if start else None,
            "date_to": end.isoformat() if end else None,
            "symbol": symbol,
            "session": session,
            "setup_id": str(setup_id) if setup_id else None,
            "direction": direction,
            "timeframe": timeframe,
            "psychology": psychology,
            "result": result,
            "options": {
                "symbols": symbols,
                "sessions": sorted({t.session for t in all_trades}),
                "setups": [{"id": i, "name": n} for i, n in setup_opts],
                "timeframes": sorted({t.timeframe for t in all_trades}),
                "psychology": sorted({t.psychology.emotion_before for t in all_trades if t.psychology}),
            },
        },
        "overview": {
            **{
                "n_trades": perf.n_trades,
                "net_pnl": perf.net_pnl,
                "expectancy_r": perf.expectancy_r,
                "win_rate": perf.win_rate,
                "profit_factor": perf.profit_factor,
                "average_r": perf.average_r,
                "max_drawdown": perf.max_drawdown,
                "current_drawdown": snap.current_drawdown,
                "average_risk": avg_risk,
                "discipline_score": discipline,
                "total_r": sum((r_of(j) or ZERO) for j in journals),
                "sample_note": perf.sample_note,
                "evidence": evidence_payload(perf.n_trades),
            }
        },
        "equity": curve,
        "drawdown": {
            "current": snap.current_drawdown,
            "current_pct": snap.current_drawdown_pct,
            "max": snap.max_drawdown,
            "max_pct": snap.max_drawdown_pct,
            "peak": snap.high_water_mark,
            "equity": snap.current_equity,
            **drawdown_episodes(snap.equity_curve),
        },
        "sessions": sessions,
        "setups": setups,
        "psychology": psych,
        "weekday": weekday,
        "r_distribution": r_distribution(journals),
        "frequency": frequency,
        "risk_vs_result": risk_scatter(journals),
        "holding_vs_result": holding_scatter(journals),
        "calendar": calendar_days(journals, user.timezone),
        "streaks": streak_histogram(journals),
        "consistency": consistency(journals, user.timezone),
        "monthly": monthly_bars(journals, starting, user.timezone),
        "rolling_expectancy": rolling_expectancy(journals, 20),
        "after_losses": after_losses,
        "risk": {
            "status": snap.status.value,
            "reasons": snap.reasons,
            "personal_daily": _util(personal_daily_used, profile.personal_daily_loss_limit),
            "personal_drawdown": _util(dd, profile.personal_max_drawdown),
            "firm_daily": _util(max(-snap.daily_pnl, ZERO) if snap.daily_pnl < ZERO else ZERO, profile.firm_daily_drawdown_limit),
            "firm_drawdown": _util(dd, profile.firm_max_drawdown_limit),
            "trades_today": snap.trades_today,
            "max_trades_per_day": profile.max_trades_per_day,
            "avg_risk_last_n": snap.avg_risk_last_n,
            "risk_escalation_pct": snap.risk_escalation_pct,
        },
        "observations": key_observations(
            sessions=sessions,
            setups=setups,
            psychology=psych,
            frequency=frequency,
            after_losses=after_losses,
            avg_risk_escalation_pct=snap.risk_escalation_pct,
            n_trades=perf.n_trades,
        ),
        "edge_matrix": edge_matrix(journals, starting),
        "edge_combos": ranked_combos(journals, starting),
    }


def edge_explorer_detail(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    symbol: str,
    session: str,
    setup: str | None = None,
    direction: str | None = None,
    preset: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    all_trades = _trades(db, user.id, account.id)
    start, end, resolved = resolve_date_window(preset, date_from, date_to, user.timezone)
    filtered = _apply_filters(
        all_trades,
        timezone=user.timezone,
        date_from=start,
        date_to=end,
        symbol=None,
        session=None,
        setup_id=None,
        direction=None,
        timeframe=None,
        psychology=None,
        result=None,
    )
    journals = [trade_to_journal(t) for t in filtered]
    detail = edge_detail(
        journals,
        Decimal(account.starting_balance),
        symbol=symbol,
        session=session,
        setup=setup,
        direction=direction,
    )
    detail["filters"] = {"preset": resolved}
    return detail
