"""Centralized Quant Lab sample-size evidence levels."""

from __future__ import annotations

from enum import StrEnum

# Configurable thresholds
INSUFFICIENT_MAX = 9
EXPLORATORY_MAX = 29
MODERATE_MAX = 99
STRONGER_MAX = 249


class EvidenceLevel(StrEnum):
    INSUFFICIENT = "INSUFFICIENT"
    EXPLORATORY = "EXPLORATORY"
    MODERATE = "MODERATE"
    STRONGER = "STRONGER"
    HIGHER_EVIDENCE = "HIGHER_EVIDENCE"


MESSAGES = {
    EvidenceLevel.INSUFFICIENT: "Too few observations for reliable inference.",
    EvidenceLevel.EXPLORATORY: "Exploratory only — high uncertainty remains.",
    EvidenceLevel.MODERATE: "Useful for exploration, but uncertainty remains.",
    EvidenceLevel.STRONGER: "Moderate evidence — still not predictive.",
    EvidenceLevel.HIGHER_EVIDENCE: "Larger sample — historical patterns may be more stable.",
}


def classify_sample(n: int) -> EvidenceLevel:
    if n <= INSUFFICIENT_MAX:
        return EvidenceLevel.INSUFFICIENT
    if n <= EXPLORATORY_MAX:
        return EvidenceLevel.EXPLORATORY
    if n <= MODERATE_MAX:
        return EvidenceLevel.MODERATE
    if n <= STRONGER_MAX:
        return EvidenceLevel.STRONGER
    return EvidenceLevel.HIGHER_EVIDENCE


def sample_payload(n: int, *, metric: str | None = None) -> dict:
    level = classify_sample(n)
    msg = MESSAGES[level]
    if metric:
        msg = f"{metric}: {msg}"
    return {
        "sample_size": n,
        "evidence_level": level.value,
        "message": msg,
        "thresholds": {
            "insufficient_max": INSUFFICIENT_MAX,
            "exploratory_max": EXPLORATORY_MAX,
            "moderate_max": MODERATE_MAX,
            "stronger_max": STRONGER_MAX,
        },
    }
