from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.core.time import utcnow
from app.engines.discipline_engine import aggregate_discipline
from app.engines.health_engine import HealthInputs, compute_health
from app.engines.performance_engine import compute_performance
from app.engines.psychology_engine import emotional_stability_score
from app.engines.risk_engine import compute_risk_snapshot
from app.models.trade import Trade
from app.models.user import User
from app.services.access import get_owned_account
from app.engines.command_center import build_command_center
from app.services.mapping import profile_view, trade_to_closed, trade_to_journal, trade_to_psych

DASHBOARD_EQUITY_POINTS = 30


def _limit_pair(limit: Decimal, remaining: Decimal) -> dict:
    return {"limit": limit, "remaining": remaining}


def dashboard(db: Session, user: User, account_id: UUID) -> dict:
    account = get_owned_account(db, user.id, account_id)
    trades = (
        db.query(Trade)
        .options(joinedload(Trade.psychology), joinedload(Trade.setup))
        .filter(Trade.account_id == account_id, Trade.user_id == user.id)
        .all()
    )
    closed_views = [trade_to_closed(t) for t in trades]
    psych_views = [trade_to_psych(t) for t in trades]
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile,
        trades=closed_views,
        now=utcnow(),
        timezone=user.timezone,
    )
    perf = compute_performance(closed_views, Decimal(account.starting_balance))
    disc_scores = [t.discipline_score for t in trades if t.discipline_score is not None]
    discipline = aggregate_discipline(disc_scores) if disc_scores else None
    emotion = emotional_stability_score(psych_views)
    health = compute_health(
        HealthInputs(
            n_trades=perf.n_trades,
            risk_status=snap.status,
            discipline_score=discipline,
            emotional_stability=emotion,
            trades_today=snap.trades_today,
            max_trades_per_day=profile.max_trades_per_day,
            current_drawdown=snap.current_drawdown,
            personal_max_drawdown=profile.personal_max_drawdown,
            consecutive_losses=snap.consecutive_losses,
        )
    )
    curve = snap.equity_curve[-DASHBOARD_EQUITY_POINTS:]
    journal = [trade_to_journal(t) for t in trades]
    command_center = build_command_center(
        trades=trades,
        journal=journal,
        closed_views=closed_views,
        snap=snap,
        profile=profile,
        starting=Decimal(account.starting_balance),
        timezone=user.timezone,
        now=utcnow(),
        perf_n=perf.n_trades,
    )
    return {
        "account": {
            "id": str(account.id),
            "name": account.account_name,
            "firm": account.firm,
            "program": account.program,
            "currency": account.currency,
            "status": account.status,
        },
        "balance": snap.current_balance,
        "equity": snap.current_equity,
        "starting_balance": snap.starting_balance,
        "daily_pnl": snap.daily_pnl,
        "total_pnl": snap.total_pnl,
        "drawdown": snap.current_drawdown,
        "drawdown_pct": snap.current_drawdown_pct,
        "max_drawdown": snap.max_drawdown,
        "win_rate": perf.win_rate,
        "expectancy_r": perf.expectancy_r,
        "profit_factor": perf.profit_factor,
        "average_r": perf.average_r,
        "n_trades": perf.n_trades,
        "current_streak_losses": snap.consecutive_losses,
        "current_streak_wins": snap.consecutive_wins,
        "discipline_score": discipline,
        "trading_health": health.score,
        "trading_health_status": health.status,
        "trading_health_trades_needed": health.trades_needed,
        "trading_health_summary": health.summary,
        "health": {
            "score": health.score,
            "status": health.status,
            "trades_needed": health.trades_needed,
        },
        "health_components": health.components,
        "risk_status": snap.status.value,
        "risk_reasons": snap.reasons,
        "trades_today": snap.trades_today,
        "max_trades_per_day": profile.max_trades_per_day,
        "distance_to_personal_daily_loss": snap.distance_to_personal_daily_loss,
        "distance_to_personal_max_dd": snap.distance_to_personal_max_dd,
        "distance_to_firm_daily_dd": snap.distance_to_firm_daily_dd,
        "distance_to_firm_max_dd": snap.distance_to_firm_max_dd,
        "personal_daily_loss": _limit_pair(
            profile.personal_daily_loss_limit, snap.distance_to_personal_daily_loss
        ),
        "personal_max_dd": _limit_pair(profile.personal_max_drawdown, snap.distance_to_personal_max_dd),
        "firm_daily_dd": _limit_pair(profile.firm_daily_drawdown_limit, snap.distance_to_firm_daily_dd),
        "firm_max_dd": _limit_pair(profile.firm_max_drawdown_limit, snap.distance_to_firm_max_dd),
        "equity_series": [{"t": p.at.isoformat(), "balance": p.equity} for p in curve],
        "sample_note": perf.sample_note,
        "sharpe": perf.sharpe,
        "sharpe_note": perf.sharpe_note.__dict__,
        "sortino": perf.sortino,
        "sortino_note": perf.sortino_note.__dict__,
        "command_center": command_center,
    }
