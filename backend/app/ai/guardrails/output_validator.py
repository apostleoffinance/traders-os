from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, ValidationError

from app.ai.guardrails.trading_signal_guard import contains_prohibited
from app.core.exceptions import AIGuardrailRejected, DomainError

FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def extract_json_object(raw: str) -> dict[str, Any]:
    text = raw.strip()
    m = FENCE.search(text)
    if m:
        text = m.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise DomainError("Model did not return JSON.", code="ai_malformed")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise DomainError("Model returned invalid JSON.", code="ai_malformed") from exc
    if not isinstance(data, dict):
        raise DomainError("Model JSON must be an object.", code="ai_malformed")
    return data


def validate_response(raw: str, schema: type[BaseModel]) -> BaseModel:
    data = extract_json_object(raw)
    if contains_prohibited(data) or contains_prohibited(raw):
        raise AIGuardrailRejected()
    banned = {
        "buy_signal",
        "sell_signal",
        "direction_prediction",
        "entry_recommendation",
        "exit_recommendation",
        "trade_recommendation",
    }
    if banned & set(data.keys()):
        raise AIGuardrailRejected()
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        raise DomainError(f"Model JSON failed schema validation: {exc.error_count()} error(s).", code="ai_malformed") from exc
