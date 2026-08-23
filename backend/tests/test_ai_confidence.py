from app.ai.guardrails.confidence import classify_confidence
from app.ai.schemas import EvidenceConfidence


def test_sample_size_gates() -> None:
    assert classify_confidence(0) == EvidenceConfidence.INSUFFICIENT
    assert classify_confidence(7) == EvidenceConfidence.INSUFFICIENT
    assert classify_confidence(10) == EvidenceConfidence.LOW
    assert classify_confidence(29) == EvidenceConfidence.LOW
    assert classify_confidence(30) == EvidenceConfidence.MODERATE
    assert classify_confidence(80) == EvidenceConfidence.HIGH


def test_variance_downgrades_high() -> None:
    assert classify_confidence(100, high_variance=True) == EvidenceConfidence.MODERATE
