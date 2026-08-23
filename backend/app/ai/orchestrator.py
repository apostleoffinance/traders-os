"""Run an analysis: cache by context hash, failover LLM, validate, guardrail retry, persist."""

from __future__ import annotations

import hashlib
import json
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.config import PROMPT_VERSION
from app.ai.guardrails.output_validator import validate_response
from app.ai.guardrails.trading_signal_guard import contains_prohibited
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.providers.router import FailoverRouter
from app.ai.schemas import SCHEMA_BY_TYPE
from app.ai.serialize import to_jsonable
from app.core.exceptions import AIGuardrailRejected, AIUnavailable, DomainError
from app.models.ai import AIAnalysis

RETRY_SUFFIX = (
    "\n\nYour previous output contained prohibited trading recommendations "
    "(buy/sell/enter/exit/signal language). Rewrite as process analysis only. "
    "JSON schema unchanged. recommendation if present must be 'none'."
)


def context_hash(payload: dict) -> str:
    blob = json.dumps(to_jsonable(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def persist(
    db: Session,
    *,
    user_id: UUID,
    account_id: UUID,
    trade_id: UUID | None,
    analysis_type: str,
    provider: str,
    model: str,
    ctx_hash: str,
    response: dict,
) -> AIAnalysis:
    row = AIAnalysis(
        user_id=user_id,
        account_id=account_id,
        trade_id=trade_id,
        analysis_type=analysis_type,
        provider=provider,
        model=model,
        prompt_version=PROMPT_VERSION,
        context_hash=ctx_hash,
        response_json=response,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def cached(
    db: Session,
    *,
    user_id: UUID,
    account_id: UUID,
    analysis_type: str,
    ctx_hash: str,
    trade_id: UUID | None,
) -> AIAnalysis | None:
    q = (
        db.query(AIAnalysis)
        .filter(
            AIAnalysis.user_id == user_id,
            AIAnalysis.account_id == account_id,
            AIAnalysis.analysis_type == analysis_type,
            AIAnalysis.context_hash == ctx_hash,
            AIAnalysis.prompt_version == PROMPT_VERSION,
        )
        .order_by(AIAnalysis.created_at.desc())
    )
    if trade_id is None:
        q = q.filter(AIAnalysis.trade_id.is_(None))
    else:
        q = q.filter(AIAnalysis.trade_id == trade_id)
    return q.first()


def run_analysis(
    db: Session,
    *,
    user_id: UUID,
    account_id: UUID,
    analysis_type: str,
    task_prompt: str,
    context: dict,
    trade_id: UUID | None = None,
    router: FailoverRouter | None = None,
    force: bool = False,
) -> dict:
    schema = SCHEMA_BY_TYPE[analysis_type]
    ctx_hash = context_hash(context)
    if not force:
        hit = cached(
            db,
            user_id=user_id,
            account_id=account_id,
            analysis_type=analysis_type,
            ctx_hash=ctx_hash,
            trade_id=trade_id,
        )
        if hit is not None:
            return {
                "id": str(hit.id),
                "analysis_type": hit.analysis_type,
                "provider": hit.provider,
                "model": hit.model,
                "prompt_version": hit.prompt_version,
                "cached": True,
                "created_at": hit.created_at.isoformat() if hit.created_at else None,
                "result": hit.response_json,
            }

    user_msg = json.dumps({"task": task_prompt, "context": context}, default=str)
    system = SYSTEM_PROMPT
    r = router or FailoverRouter()
    raw, provider, model = r.complete_json(system=system, user=user_msg, schema_name=analysis_type)
    parsed: BaseModel | None = None
    try:
        parsed = validate_response(raw, schema)
    except AIGuardrailRejected:
        raw2, provider, model = r.complete_json(
            system=system + RETRY_SUFFIX,
            user=user_msg,
            schema_name=analysis_type,
        )
        if contains_prohibited(raw2):
            raise AIGuardrailRejected()
        parsed = validate_response(raw2, schema)
    except DomainError:
        # one repair pass for malformed JSON
        raw2, provider, model = r.complete_json(
            system=system + "\nReturn valid JSON only. No markdown.",
            user=user_msg,
            schema_name=analysis_type,
        )
        parsed = validate_response(raw2, schema)

    result = parsed.model_dump(mode="json")
    row = persist(
        db,
        user_id=user_id,
        account_id=account_id,
        trade_id=trade_id,
        analysis_type=analysis_type,
        provider=provider,
        model=model,
        ctx_hash=ctx_hash,
        response=result,
    )
    return {
        "id": str(row.id),
        "analysis_type": row.analysis_type,
        "provider": row.provider,
        "model": row.model,
        "prompt_version": row.prompt_version,
        "cached": False,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "result": result,
    }
