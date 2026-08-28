from __future__ import annotations

import json
import logging
import re
from enum import StrEnum
from typing import Any, get_args, get_origin

from pydantic import BaseModel, ValidationError

from app.ai.guardrails.trading_signal_guard import contains_prohibited
from app.ai.messages import AI_MALFORMED_MESSAGE
from app.core.exceptions import AIGuardrailRejected, DomainError

logger = logging.getLogger(__name__)

FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)

_ENUM_ALIASES: dict[str, dict[str, str]] = {
    "financial_outcome": {
        "WIN": "POSITIVE",
        "WINNING": "POSITIVE",
        "PROFIT": "POSITIVE",
        "GAIN": "POSITIVE",
        "LOSS": "NEGATIVE",
        "LOSING": "NEGATIVE",
        "LOSE": "NEGATIVE",
        "BREAKEVEN": "FLAT",
        "BREAK_EVEN": "FLAT",
        "BE": "FLAT",
        "NEUTRAL": "FLAT",
    },
    "discipline_assessment": {
        "AVERAGE": "MIXED",
        "FAIR": "MIXED",
        "OK": "MIXED",
        "OKAY": "MIXED",
        "STRONG": "GOOD",
        "WEAK": "POOR",
        "BAD": "POOR",
    },
    "confidence": {
        "MEDIUM": "MODERATE",
        "MID": "MODERATE",
        "NONE": "INSUFFICIENT",
        "UNKNOWN": "INSUFFICIENT",
        "VERY_LOW": "LOW",
        "VERY_HIGH": "HIGH",
    },
}


def extract_json_object(raw: str) -> dict[str, Any]:
    text = raw.strip()
    m = FENCE.search(text)
    if m:
        text = m.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise DomainError(AI_MALFORMED_MESSAGE, code="ai_malformed")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise DomainError(AI_MALFORMED_MESSAGE, code="ai_malformed") from exc
    if not isinstance(data, dict):
        raise DomainError(AI_MALFORMED_MESSAGE, code="ai_malformed")
    return data


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if "\n" in text:
            return [line.strip(" •-\t") for line in text.splitlines() if line.strip()]
        return [text]
    return [str(value)]


def _normalize_enum(value: Any, enum_cls: type[StrEnum], field: str) -> Any:
    if not isinstance(value, str):
        return value
    key = value.strip().upper().replace("-", "_").replace(" ", "_")
    aliases = _ENUM_ALIASES.get(field, {})
    key = aliases.get(key, key)
    allowed = {member.value for member in enum_cls}
    if key in allowed:
        return key
    return value


def _normalize_int(value: Any, *, lo: int | None = None, hi: int | None = None) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        n = value
    elif isinstance(value, float):
        n = int(round(value))
    elif isinstance(value, str):
        try:
            n = int(round(float(value.strip().rstrip("%"))))
        except ValueError:
            return value
    else:
        return value
    if lo is not None:
        n = max(lo, n)
    if hi is not None:
        n = min(hi, n)
    return n


def _field_annotation(field_info: Any) -> Any:
    return field_info.annotation


def _is_str_enum(annotation: Any) -> type[StrEnum] | None:
    if isinstance(annotation, type) and issubclass(annotation, StrEnum):
        return annotation
    return None


def _is_list_of_str(annotation: Any) -> bool:
    origin = get_origin(annotation)
    if origin is list:
        args = get_args(annotation)
        return bool(args) and args[0] is str
    return False


def normalize_for_schema(data: dict[str, Any], schema: type[BaseModel]) -> dict[str, Any]:
    """Coerce common LLM mistakes (casing, list shapes, numeric strings) before validation."""
    out = dict(data)
    for name, field in schema.model_fields.items():
        if name not in out:
            continue
        ann = _field_annotation(field)
        enum_cls = _is_str_enum(ann)
        if enum_cls is not None:
            out[name] = _normalize_enum(out[name], enum_cls, name)
        elif _is_list_of_str(ann):
            out[name] = _as_str_list(out[name])
        elif ann is int:
            lo = hi = None
            for meta in field.metadata:
                ge = getattr(meta, "ge", None)
                le = getattr(meta, "le", None)
                if ge is not None:
                    lo = int(ge)
                if le is not None:
                    hi = int(le)
            out[name] = _normalize_int(out[name], lo=lo, hi=hi)
    return out


def _validation_repair_hint(exc: ValidationError) -> str:
    parts: list[str] = []
    for err in exc.errors()[:10]:
        loc = ".".join(str(p) for p in err.get("loc", ()))
        msg = err.get("msg", "invalid")
        parts.append(f"{loc}: {msg}")
    return "; ".join(parts)


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
    data = normalize_for_schema(data, schema)
    try:
        return schema.model_validate(data)
    except ValidationError as exc:
        hint = _validation_repair_hint(exc)
        logger.warning("AI schema validation failed for %s: %s", schema.__name__, hint)
        raise DomainError(AI_MALFORMED_MESSAGE, code="ai_malformed", repair_hint=hint) from exc
