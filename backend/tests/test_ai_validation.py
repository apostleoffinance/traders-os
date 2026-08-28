from app.ai.guardrails.output_validator import extract_json_object, normalize_for_schema, validate_response
from app.ai.schemas import TradeReviewResponse
from app.core.exceptions import AIGuardrailRejected, DomainError
import pytest


def test_extracts_fenced_json() -> None:
    raw = '```json\n{"summary": "x", "financial_outcome": "POSITIVE", "execution_quality": 80, "discipline_assessment": "GOOD", "confidence": "LOW"}\n```'
    obj = extract_json_object(raw)
    assert obj["summary"] == "x"


def test_schema_accepts_valid_review() -> None:
    raw = '{"summary": "Losing trade, rules followed.", "financial_outcome": "NEGATIVE", "execution_quality": 88, "discipline_assessment": "GOOD", "confidence": "INSUFFICIENT", "historical_context": ["n=4 comparables"]}'
    parsed = validate_response(raw, TradeReviewResponse)
    assert parsed.execution_quality == 88
    assert parsed.financial_outcome.value == "NEGATIVE"


def test_normalizes_lowercase_enums_and_string_lists() -> None:
    raw = {
        "summary": "Mixed process.",
        "financial_outcome": "loss",
        "execution_quality": "72",
        "discipline_assessment": "good",
        "confidence": "moderate",
        "behavioral_observations": "rushed entry",
        "rule_violations": "",
    }
    normalized = normalize_for_schema(raw, TradeReviewResponse)
    parsed = TradeReviewResponse.model_validate(normalized)
    assert parsed.financial_outcome.value == "NEGATIVE"
    assert parsed.discipline_assessment.value == "GOOD"
    assert parsed.confidence.value == "MODERATE"
    assert parsed.execution_quality == 72
    assert parsed.behavioral_observations == ["rushed entry"]
    assert parsed.rule_violations == []


def test_validate_coerces_common_model_mistakes() -> None:
    raw = '{"summary": "Win with poor sizing.", "financial_outcome": "win", "execution_quality": 65.4, "discipline_assessment": "mixed", "confidence": "low"}'
    parsed = validate_response(raw, TradeReviewResponse)
    assert parsed.financial_outcome.value == "POSITIVE"
    assert parsed.discipline_assessment.value == "MIXED"
    assert parsed.execution_quality == 65


def test_malformed_raises_user_safe_error() -> None:
    raw = '{"summary": "x"}'
    with pytest.raises(DomainError) as exc:
        validate_response(raw, TradeReviewResponse)
    assert exc.value.code == "ai_malformed"
    assert exc.value.repair_hint
    assert "schema validation" not in exc.value.message.lower()


def test_rejects_signal_in_summary() -> None:
    raw = '{"summary": "BUY EURUSD on the next sweep", "financial_outcome": "POSITIVE", "execution_quality": 50, "discipline_assessment": "POOR", "confidence": "LOW"}'
    with pytest.raises(AIGuardrailRejected):
        validate_response(raw, TradeReviewResponse)


def test_rejects_non_json() -> None:
    with pytest.raises(DomainError):
        extract_json_object("not json at all")
