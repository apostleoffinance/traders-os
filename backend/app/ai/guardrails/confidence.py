"""Re-export engine evidence labels so AI and Analytics share one classifier."""

from __future__ import annotations

from app.ai.schemas import EvidenceConfidence
from app.engines.evidence import EvidenceLevel
from app.engines.evidence import classify_confidence as _classify
from app.engines.evidence import confidence_reason as _reason


def classify_confidence(n: int, *, high_variance: bool = False, incomplete: bool = False) -> EvidenceConfidence:
    return EvidenceConfidence(_classify(n, high_variance=high_variance, incomplete=incomplete).value)


def confidence_reason(n: int, level: EvidenceConfidence) -> str:
    return _reason(n, EvidenceLevel(level.value))
