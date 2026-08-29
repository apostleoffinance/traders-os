"""Centralized sample-size thresholds for Analytics Lab."""

from __future__ import annotations

from app.engines.evidence import evidence_payload

# Display thresholds (configurable constants — do not scatter magic numbers)
MIN_SAMPLE_SIZE_DISPLAY = 5
MIN_SAMPLE_SIZE_EDGE = 20
MIN_SAMPLE_SIZE_INFERENCE = 10

BREAKEVEN_TOLERANCE = "0.01"  # currency units; applied via Decimal


def sample_label(n: int) -> str:
    if n < MIN_SAMPLE_SIZE_DISPLAY:
        return "insufficient"
    if n < MIN_SAMPLE_SIZE_EDGE:
        return "low"
    return "standard"


def sample_note(n: int) -> str | None:
    if n == 0:
        return "No closed trades match the selected filters."
    if n < MIN_SAMPLE_SIZE_DISPLAY:
        return f"Insufficient sample size — n={n}. Add more closed trades for a reliable comparison."
    if n < MIN_SAMPLE_SIZE_EDGE:
        return f"Low sample size — n={n}. Metrics are descriptive only."
    return None


def with_evidence(n: int) -> dict:
    return evidence_payload(n)
