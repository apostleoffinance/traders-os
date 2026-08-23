from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.ai.context import (
    build_account_analytics_context,
    build_period_context,
    build_trade_review_context,
)
from app.ai.orchestrator import run_analysis
from app.ai.prompts import (
    BEHAVIORAL_PROMPT,
    CHALLENGE_PROMPT,
    COACH_PROMPT,
    PATTERN_PROMPT,
    PERIOD_PROMPT,
    TRADE_REVIEW_PROMPT,
)
from app.models.ai import AIAnalysis, AIMemory
from app.models.user import User
from app.services.access import get_owned_account, get_owned_trade
from app.engines.performance_engine import MIN_INSIGHT_N


def trade_review(db: Session, user: User, trade_id: UUID, force: bool = False) -> dict:
    trade = get_owned_trade(db, user.id, trade_id)
    ctx = build_trade_review_context(db, user, trade)
    return run_analysis(
        db,
        user_id=user.id,
        account_id=trade.account_id,
        analysis_type="trade_review",
        task_prompt=TRADE_REVIEW_PROMPT,
        context=ctx,
        trade_id=trade.id,
        force=force,
    )


def challenge_trade(db: Session, user: User, trade_id: UUID, force: bool = False) -> dict:
    trade = get_owned_trade(db, user.id, trade_id)
    ctx = build_trade_review_context(db, user, trade)
    return run_analysis(
        db,
        user_id=user.id,
        account_id=trade.account_id,
        analysis_type="challenge_trade",
        task_prompt=CHALLENGE_PROMPT,
        context=ctx,
        trade_id=trade.id,
        force=force,
    )


def _account_run(
    db: Session,
    user: User,
    account_id: UUID,
    analysis_type: str,
    prompt: str,
    force: bool,
    last_n: int = 30,
) -> dict:
    get_owned_account(db, user.id, account_id)
    ctx = build_account_analytics_context(db, user, account_id, last_n=last_n)
    if analysis_type == "coach":
        mems = (
            db.query(AIMemory)
            .filter(AIMemory.user_id == user.id, AIMemory.account_id == account_id)
            .all()
        )
        ctx["memories"] = [{"key": m.key, "value": m.value, "source": m.source} for m in mems]
        refresh_validated_memories(db, user.id, account_id, ctx)
        mems = (
            db.query(AIMemory)
            .filter(AIMemory.user_id == user.id, AIMemory.account_id == account_id)
            .all()
        )
        ctx["memories"] = [{"key": m.key, "value": m.value, "source": m.source} for m in mems]
    return run_analysis(
        db,
        user_id=user.id,
        account_id=account_id,
        analysis_type=analysis_type,
        task_prompt=prompt,
        context=ctx,
        force=force,
    )


def period_review(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str = "last_20",
    start: str | None = None,
    end: str | None = None,
    force: bool = False,
) -> dict:
    get_owned_account(db, user.id, account_id)
    ctx = build_period_context(db, user, account_id, preset=preset, start=start, end=end)
    return run_analysis(
        db,
        user_id=user.id,
        account_id=account_id,
        analysis_type="period_review",
        task_prompt=PERIOD_PROMPT,
        context=ctx,
        force=force,
    )


def weekly(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return period_review(db, user, account_id, preset="this_week", force=force)


def monthly(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return period_review(db, user, account_id, preset="this_month", force=force)


def journal_summary(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return period_review(db, user, account_id, preset="last_20", force=force)


def behavioral(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return _account_run(db, user, account_id, "behavioral_analysis", BEHAVIORAL_PROMPT, force)


def patterns(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return _account_run(db, user, account_id, "pattern_analysis", PATTERN_PROMPT, force)


def coach(db: Session, user: User, account_id: UUID, force: bool = False) -> dict:
    return _account_run(db, user, account_id, "coach", COACH_PROMPT, force)


def refresh_validated_memories(db: Session, user_id: UUID, account_id: UUID, ctx: dict) -> None:
    """Write only facts that pass sample-size gates. Never invent."""
    facts: list[tuple[str, str]] = []
    sessions = ctx.get("by_session") or []
    eligible = [s for s in sessions if int(s.get("n") or 0) >= MIN_INSIGHT_N]
    if eligible:
        best = max(eligible, key=lambda s: (s.get("expectancy_r") is not None, s.get("expectancy_r") or 0, s["n"]))
        facts.append(
            (
                "session_with_highest_expectancy",
                f"{best['key']} n={best['n']} expectancy_r={best.get('expectancy_r')}",
            )
        )
    setups = ctx.get("by_setup") or []
    eligible_s = [s for s in setups if int(s.get("n") or 0) >= MIN_INSIGHT_N]
    if eligible_s:
        best = max(eligible_s, key=lambda s: s["n"])
        facts.append(("most_used_setup", f"{best['key']} n={best['n']}"))
    overall = ctx.get("overall") or {}
    if int(overall.get("n") or 0) >= MIN_INSIGHT_N:
        facts.append(
            (
                "overall_expectancy",
                f"n={overall.get('n')} expectancy_r={overall.get('expectancy_r')}",
            )
        )
    for key, value in facts:
        existing = (
            db.query(AIMemory)
            .filter(
                AIMemory.user_id == user_id,
                AIMemory.account_id == account_id,
                AIMemory.key == key,
            )
            .one_or_none()
        )
        if existing:
            existing.value = value
            existing.source = "validated_history"
        else:
            db.add(
                AIMemory(
                    user_id=user_id,
                    account_id=account_id,
                    key=key,
                    value=value,
                    source="validated_history",
                )
            )
    db.commit()


def list_analyses(db: Session, user_id: UUID, account_id: UUID, limit: int = 50) -> list[AIAnalysis]:
    get_owned_account(db, user_id, account_id)
    return (
        db.query(AIAnalysis)
        .filter(AIAnalysis.user_id == user_id, AIAnalysis.account_id == account_id)
        .order_by(AIAnalysis.created_at.desc())
        .limit(limit)
        .all()
    )


def latest_of_types(db: Session, user_id: UUID, account_id: UUID, types: list[str]) -> dict[str, AIAnalysis]:
    out: dict[str, AIAnalysis] = {}
    for t in types:
        row = (
            db.query(AIAnalysis)
            .filter(
                AIAnalysis.user_id == user_id,
                AIAnalysis.account_id == account_id,
                AIAnalysis.analysis_type == t,
            )
            .order_by(AIAnalysis.created_at.desc())
            .first()
        )
        if row:
            out[t] = row
    return out
