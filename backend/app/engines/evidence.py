"""Deterministic evidence-strength labels. Shared by analytics and AI.

The LLM must not invent these. Thresholds are sample-size based.
"""

from __future__ import annotations

from enum import StrEnum


class EvidenceLevel(StrEnum):
    INSUFFICIENT = "INSUFFICIENT"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


MIN_N = {EvidenceLevel.LOW: 10, EvidenceLevel.MODERATE: 30, EvidenceLevel.HIGH: 80}

DISPLAY = {
    EvidenceLevel.INSUFFICIENT: "Insufficient",
    EvidenceLevel.LOW: "Limited",
    EvidenceLevel.MODERATE: "Moderate",
    EvidenceLevel.HIGH: "Strong",
}


def classify_confidence(n: int, *, high_variance: bool = False, incomplete: bool = False) -> EvidenceLevel:
    if n < MIN_N[EvidenceLevel.LOW]:
        level = EvidenceLevel.INSUFFICIENT
    elif n < MIN_N[EvidenceLevel.MODERATE]:
        level = EvidenceLevel.LOW
    elif n < MIN_N[EvidenceLevel.HIGH]:
        level = EvidenceLevel.MODERATE
    else:
        level = EvidenceLevel.HIGH
    if incomplete and level == EvidenceLevel.HIGH:
        level = EvidenceLevel.MODERATE
    elif high_variance and level == EvidenceLevel.HIGH:
        level = EvidenceLevel.MODERATE
    elif high_variance and level == EvidenceLevel.MODERATE:
        level = EvidenceLevel.LOW
    return level


def confidence_reason(n: int, level: EvidenceLevel) -> str:
    if level == EvidenceLevel.INSUFFICIENT:
        return f"Only {n} observation(s). Treat as descriptive, not an edge."
    if level == EvidenceLevel.LOW:
        return f"n={n} — limited evidence. Worth noting, not acting as a rule."
    if level == EvidenceLevel.MODERATE:
        return f"n={n} — moderate historical sample. Investigate consistency across months."
    return f"n={n} — large sample. Still historical, not a prediction."


def evidence_payload(n: int, *, high_variance: bool = False) -> dict:
    level = classify_confidence(n, high_variance=high_variance)
    return {
        "n": n,
        "level": level.value,
        "label": DISPLAY[level],
        "reason": confidence_reason(n, level),
    }
