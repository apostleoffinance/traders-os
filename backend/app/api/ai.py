from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.ai.context import build_account_analytics_context, period_preview
from app.ai.messages import AI_UNAVAILABLE_MESSAGE
from app.ai.providers.router import FailoverRouter
from app.ai import services as ai_services
from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.services import auth_service

router = APIRouter(prefix="/ai", tags=["intelligence"])


class FindingExplanationBody(BaseModel):
    """Structured finding evidence — quantitative fields are authoritative."""

    finding_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=400)
    summary: str = Field(default="", max_length=2000)
    domain: str = Field(default="general", max_length=64)
    severity: str = Field(default="INFO", max_length=32)
    confidence: str = Field(min_length=1, max_length=80)
    sample_size: int = Field(ge=0, le=1_000_000)
    fact_lines: list[str] = Field(default_factory=list, max_length=40)
    why_it_matters: str = Field(default="", max_length=2000)
    why_surfaced: str = Field(default="", max_length=2000)
    investigation_hint: str = Field(default="", max_length=400)
    period_label: str | None = Field(default=None, max_length=80)

def _user(db: Session, user_id: UUID):
    return auth_service.get_user(db, user_id)


@router.get("/status")
def ai_status():
    names = FailoverRouter().available_names()
    return {
        "configured_providers": names,
        "available": bool(names),
        "message": None if names else AI_UNAVAILABLE_MESSAGE,
    }


@router.get("/accounts/{account_id}/widget")
def widget(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    """Deterministic snapshot + last cached analyses. Does not call an LLM."""
    try:
        user = _user(db, user_id)
        ctx = build_account_analytics_context(db, user, account_id, last_n=20)
        cached = ai_services.latest_of_types(
            db, user.id, account_id, ["period_review", "behavioral_analysis", "coach"]
        )
        last_n = ctx.get("last_n") or {}
        behavior = ctx.get("behavior") or {}
        account = ctx.get("account") or {}
        risk = (account.get("risk_status") or {}).get("status")
        return {
            "risk_status": risk,
            "last_20": last_n,
            "behavior": {
                "avg_risk_after_loss": behavior.get("avg_risk_after_loss"),
                "avg_risk_after_win": behavior.get("avg_risk_after_win"),
                "trades_after_two_plus_losses": behavior.get("trades_after_two_plus_losses"),
                "revenge_or_emotional_count": behavior.get("revenge_or_emotional_count"),
            },
            "cached": {
                k: {
                    "id": str(v.id),
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                    "summary": (v.response_json or {}).get("summary")
                    or (v.response_json or {}).get("period_label"),
                }
                for k, v in cached.items()
            },
            "note": "This widget does not call an AI model. Click an Intelligence action to generate analysis.",
        }
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/accounts/{account_id}/history")
def history(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        rows = ai_services.list_analyses(db, user_id, account_id)
        return [
            {
                "id": str(r.id),
                "analysis_type": r.analysis_type,
                "provider": r.provider,
                "model": r.model,
                "trade_id": str(r.trade_id) if r.trade_id else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    except DomainError as exc:
        raise http_error(exc) from exc


def _run(fn, db, user_id, **kwargs):
    try:
        return fn(db, _user(db, user_id), **kwargs)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/trades/{trade_id}/review")
def review_trade(
    trade_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.trade_review, db, user_id, trade_id=trade_id, force=force)


@router.post("/trades/{trade_id}/challenge")
def challenge(
    trade_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.challenge_trade, db, user_id, trade_id=trade_id, force=force)


@router.post("/accounts/{account_id}/journal-summary")
def journal_summary(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.journal_summary, db, user_id, account_id=account_id, force=force)


@router.post("/accounts/{account_id}/behavior")
def behavior(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.behavioral, db, user_id, account_id=account_id, force=force)


@router.post("/accounts/{account_id}/patterns")
def patterns(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.patterns, db, user_id, account_id=account_id, force=force)


@router.get("/accounts/{account_id}/period")
def period_meta(
    account_id: UUID,
    preset: str = Query("last_20"),
    start: str | None = Query(None),
    end: str | None = Query(None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return period_preview(db, _user(db, user_id), account_id, preset=preset, start=start, end=end)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/accounts/{account_id}/period-review")
def period_review(
    account_id: UUID,
    preset: str = Query("last_20"),
    start: str | None = Query(None),
    end: str | None = Query(None),
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(
        ai_services.period_review,
        db,
        user_id,
        account_id=account_id,
        preset=preset,
        start=start,
        end=end,
        force=force,
    )


@router.post("/accounts/{account_id}/weekly")
def weekly(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.weekly, db, user_id, account_id=account_id, force=force)


@router.post("/accounts/{account_id}/monthly")
def monthly(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.monthly, db, user_id, account_id=account_id, force=force)


@router.post("/accounts/{account_id}/coach")
def coach(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.coach, db, user_id, account_id=account_id, force=force)


@router.post("/accounts/{account_id}/finding-explanation")
def finding_explanation(
    account_id: UUID,
    body: FindingExplanationBody,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    """Explain a deterministic Intelligence finding. Numbers in the body are authoritative."""
    finding = body.model_dump()
    finding["fact_lines"] = [line[:500] for line in finding.get("fact_lines") or []][:40]
    return _run(
        ai_services.finding_explanation,
        db,
        user_id,
        account_id=account_id,
        finding=finding,
        force=force,
    )


@router.post("/accounts/{account_id}/quant-research")
def quant_research(
    account_id: UUID,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _run(ai_services.quant_research, db, user_id, account_id=account_id, force=force)
