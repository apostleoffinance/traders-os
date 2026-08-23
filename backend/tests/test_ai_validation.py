from app.ai.guardrails.output_validator import extract_json_object, validate_response
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


def test_rejects_signal_in_summary() -> None:
    raw = '{"summary": "BUY EURUSD on the next sweep", "financial_outcome": "POSITIVE", "execution_quality": 50, "discipline_assessment": "POOR", "confidence": "LOW"}'
    with pytest.raises(AIGuardrailRejected):
        validate_response(raw, TradeReviewResponse)


def test_rejects_non_json() -> None:
    with pytest.raises(DomainError):
        extract_json_object("not json at all")
