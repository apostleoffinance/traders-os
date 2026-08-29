"""Report-wide confidence classification."""

from __future__ import annotations

from app.engines.reports.constants import (
    MIN_SAMPLE_SIZE_BASIC,
    MIN_SAMPLE_SIZE_RESEARCH,
    MIN_SAMPLE_SIZE_STATISTICAL,
)


def confidence_level(n: int, *, completeness_pct: float | None = None) -> str:
    if n < MIN_SAMPLE_SIZE_BASIC:
        return "INSUFFICIENT_SAMPLE"
    if n < MIN_SAMPLE_SIZE_RESEARCH:
        return "LOW_CONFIDENCE"
    if n < MIN_SAMPLE_SIZE_STATISTICAL:
        level = "MODERATE_CONFIDENCE"
    else:
        level = "HIGH_CONFIDENCE"
    if completeness_pct is not None and completeness_pct < 60 and level == "HIGH_CONFIDENCE":
        return "MODERATE_CONFIDENCE"
    return level


def confidence_payload(n: int, *, completeness_pct: float | None = None) -> dict:
    level = confidence_level(n, completeness_pct=completeness_pct)
    messages = {
        "INSUFFICIENT_SAMPLE": f"n={n} — conclusions should be treated as descriptive only.",
        "LOW_CONFIDENCE": f"n={n} — patterns may be noise; avoid strong conclusions.",
        "MODERATE_CONFIDENCE": f"n={n} — useful for review; validate before changing process.",
        "HIGH_CONFIDENCE": f"n={n} — sample supports stronger comparative statements.",
    }
    return {
        "level": level,
        "n": n,
        "thresholds": {
            "basic": MIN_SAMPLE_SIZE_BASIC,
            "research": MIN_SAMPLE_SIZE_RESEARCH,
            "statistical": MIN_SAMPLE_SIZE_STATISTICAL,
        },
        "message": messages[level],
    }
