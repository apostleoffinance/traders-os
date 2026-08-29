"""Phase 3 data confidence layer — configurable thresholds."""

from __future__ import annotations

from enum import StrEnum

# Configurable Phase 3 thresholds (spec: 0-4, 5-19, 20-49, 50+)
PHASE3_INSUFFICIENT_MAX = 4
PHASE3_LOW_MAX = 19
PHASE3_MODERATE_MAX = 49


class ConfidenceLevel(StrEnum):
    INSUFFICIENT = "INSUFFICIENT"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


MESSAGES = {
    ConfidenceLevel.INSUFFICIENT: "Not enough data yet. Treat as descriptive only.",
    ConfidenceLevel.LOW: "Early pattern. More observations are needed.",
    ConfidenceLevel.MODERATE: "Moderate sample. Patterns may still shift with more data.",
    ConfidenceLevel.HIGH: "Larger sample available. Still historical — not predictive.",
}


def classify_confidence(n: int) -> ConfidenceLevel:
    if n <= PHASE3_INSUFFICIENT_MAX:
        return ConfidenceLevel.INSUFFICIENT
    if n <= PHASE3_LOW_MAX:
        return ConfidenceLevel.LOW
    if n <= PHASE3_MODERATE_MAX:
        return ConfidenceLevel.MODERATE
    return ConfidenceLevel.HIGH


def confidence_payload(
    n: int,
    *,
    metric: str | None = None,
    completeness: float | None = None,
) -> dict:
    level = classify_confidence(n)
    msg = MESSAGES[level]
    if metric:
        msg = f"{metric}: {msg}"
    out = {
        "sample_size": n,
        "confidence_level": level.value,
        "confidence": level.value,
        "message": msg,
    }
    if completeness is not None:
        out["data_completeness"] = round(completeness, 4)
    return out


def min_trades_message(threshold: int, feature: str) -> str:
    return f"You need at least {threshold} qualifying trades to unlock {feature}."
