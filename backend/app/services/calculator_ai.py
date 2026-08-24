"""Calculator AI: NL parse + explanation via FailoverRouter. Never performs financial math."""

from __future__ import annotations

import json
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.ai.guardrails.trading_signal_guard import contains_prohibited
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.providers.router import FailoverRouter
from app.core.exceptions import AIGuardrailRejected, DomainError
from app.engines.fx_math import normalize_symbol
from app.models.user import User
from app.schemas.calculator import CalculatorCalculateIn, CalcModeIn
from app.services import calculator_service


PARSE_PROMPT = """Extract structured trade calculator parameters from the user's text.

Return JSON only matching schema calculator_parse.
Do NOT calculate stop-loss, take-profit, position size, risk, reward, pips, or P/L.
Do NOT invent missing numeric fields — omit them or set null.
Do NOT recommend buy/sell/long/short as advice; only extract the direction the user already stated.
If direction is not stated, set direction to null.
Prefer ISO-like symbols: EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSDT.
mode should be one of: risk_to_levels, entry_sl_to_size, trade_analysis, target_distance, fixed_risk_sl.
If unclear, use fixed_risk_sl when entry+sl+risk are present; risk_to_levels when lot+risk+reward without SL.
missing_fields: list required fields still needed for a calculation.
"""

EXPLAIN_PROMPT = """Explain the PROVIDED calculation results in plain language for a trading journal.

Rules:
- Use ONLY numbers present in the context.calculation and context.policy.
- Do NOT recalculate, invent, or adjust any figure.
- Do NOT give buy/sell/entry advice or probability claims.
- Frame as calculated parameters and policy status.
- Mention when requested risk differs from calculated risk due to lot-step rounding.
Return JSON matching schema calculator_explain.
"""


class CalculatorParseModel(BaseModel):
    instrument: str | None = None
    direction: str | None = None
    mode: str | None = None
    entry: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    position_size: Decimal | None = None
    risk_amount: Decimal | None = None
    reward_amount: Decimal | None = None
    risk_percent: Decimal | None = None
    missing_fields: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)

    @field_validator("direction")
    @classmethod
    def _dir(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.lower().strip()
        if s in {"long", "buy"}:
            return "long"
        if s in {"short", "sell"}:
            return "short"
        return None

    @field_validator("instrument")
    @classmethod
    def _sym(cls, v: str | None) -> str | None:
        if not v:
            return None
        return normalize_symbol(v)


class CalculatorExplainModel(BaseModel):
    explanation: str
    highlights: list[str] = Field(default_factory=list)
    policy_note: str | None = None


def parse_natural_language(db: Session, user: User, account_id: UUID, text: str) -> dict:
    router = FailoverRouter()
    user_msg = json.dumps(
        {
            "task": PARSE_PROMPT,
            "user_text": text,
            "allowed_instruments": [i["symbol"] for i in calculator_service.list_calculator_instruments()],
            "account_context": calculator_service.account_context(db, user, account_id),
        },
        default=str,
    )
    raw, provider, model = router.complete_json(
        system=SYSTEM_PROMPT,
        user=user_msg,
        schema_name="calculator_parse",
    )
    if contains_prohibited(raw):
        raise AIGuardrailRejected("AI response contained prohibited trading-signal language.")
    try:
        data = json.loads(raw)
        parsed = CalculatorParseModel.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise DomainError("Could not interpret that request. Try clearer numbers and instrument.") from exc

    missing = list(parsed.missing_fields)
    if not parsed.instrument:
        missing.append("instrument")
    if not parsed.direction:
        missing.append("direction")
    if parsed.entry is None:
        missing.append("entry")

    # De-dupe missing
    seen: set[str] = set()
    missing_u = []
    for m in missing:
        if m not in seen:
            seen.add(m)
            missing_u.append(m)

    ready = len(missing_u) == 0
    draft = {
        "mode": parsed.mode or CalcModeIn.FIXED_RISK_SL.value,
        "symbol": parsed.instrument,
        "direction": parsed.direction,
        "entry": str(parsed.entry) if parsed.entry is not None else None,
        "stop_loss": str(parsed.stop_loss) if parsed.stop_loss is not None else None,
        "take_profit": str(parsed.take_profit) if parsed.take_profit is not None else None,
        "lot_size": str(parsed.position_size) if parsed.position_size is not None else None,
        "risk_amount": str(parsed.risk_amount) if parsed.risk_amount is not None else None,
        "reward_amount": str(parsed.reward_amount) if parsed.reward_amount is not None else None,
        "risk_percent": str(parsed.risk_percent) if parsed.risk_percent is not None else None,
    }
    return {
        "ready": ready,
        "missing_fields": missing_u,
        "draft": draft,
        "notes": parsed.notes,
        "provider": provider,
        "model": model,
        "disclaimer": "AI extracted parameters only. Trader OS performs all calculations.",
    }


def explain_calculation(db: Session, user: User, account_id: UUID, calculation: dict, policy: dict | None) -> dict:
    # Ensure account ownership
    calculator_service.account_context(db, user, account_id)
    router = FailoverRouter()
    user_msg = json.dumps(
        {
            "task": EXPLAIN_PROMPT,
            "context": {
                "calculation": calculation,
                "policy": policy,
                "notice": "AI explanation based on Trader OS calculations.",
            },
        },
        default=str,
    )
    raw, provider, model = router.complete_json(
        system=SYSTEM_PROMPT,
        user=user_msg,
        schema_name="calculator_explain",
    )
    if contains_prohibited(raw):
        raise AIGuardrailRejected("AI response contained prohibited trading-signal language.")
    try:
        data = json.loads(raw)
        explained = CalculatorExplainModel.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise DomainError("Unable to generate explanation.") from exc

    return {
        "explanation": explained.explanation,
        "highlights": explained.highlights,
        "policy_note": explained.policy_note,
        "provider": provider,
        "model": model,
        "disclaimer": "AI explanation based on Trader OS calculations.",
    }


def calculate_from_parse(db: Session, user: User, account_id: UUID, draft: dict) -> dict:
    """Validate draft then run deterministic calculate."""
    try:
        payload = CalculatorCalculateIn(
            account_id=account_id,
            mode=draft.get("mode") or CalcModeIn.FIXED_RISK_SL,
            symbol=draft["symbol"],
            direction=draft["direction"],
            entry=Decimal(str(draft["entry"])),
            lot_size=Decimal(str(draft["lot_size"])) if draft.get("lot_size") else None,
            stop_loss=Decimal(str(draft["stop_loss"])) if draft.get("stop_loss") else None,
            take_profit=Decimal(str(draft["take_profit"])) if draft.get("take_profit") else None,
            risk_amount=Decimal(str(draft["risk_amount"])) if draft.get("risk_amount") else None,
            reward_amount=Decimal(str(draft["reward_amount"])) if draft.get("reward_amount") else None,
            risk_percent=Decimal(str(draft["risk_percent"])) if draft.get("risk_percent") else None,
        )
    except (KeyError, ValidationError, Exception) as exc:
        raise DomainError("Parsed parameters are incomplete or invalid.") from exc
    return calculator_service.run_calculate(db, user, payload)
