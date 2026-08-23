"""Application-level rejection of trading-signal language. Prompts are not enough."""

from __future__ import annotations

import re
from typing import Any

PROHIBITED_PATTERNS = [
    r"\bbuy\s+(?:now\s+)?(?:eurusd|gbpusd|usd|gold|xau|btc|eth|sol)\b",
    r"\bsell\s+(?:now\s+)?(?:eurusd|gbpusd|usd|gold|xau|btc|eth|sol)\b",
    r"\blong\s+eurusd\b",
    r"\bshort\s+eurusd\b",
    r"\bbuy\s+signal\b",
    r"\bsell\s+signal\b",
    r"\benter\s+now\b",
    r"\bbuy\s+now\b",
    r"\bsell\s+now\b",
    r"\bexit\s+now\b",
    r"\bopen\s+(?:a\s+)?position\b",
    r"\bclose\s+(?:the\s+)?position\b",
    r"\btarget\s+price\b",
    r"\bentry\s+(?:price\s+)?recommendation\b",
    r"\bstop[\s-]?loss\s+recommendation\b",
    r"\btake[\s-]?profit\s+recommendation\b",
    r"\bshould\s+(?:you\s+)?(?:buy|sell|long|short)\b",
    r"\bgo\s+(?:long|short)\s+now\b",
    r"\bprobability\s+of\s+winning\s*=?\s*\d",
    r"\b\d{2,3}\s*%\s*(?:buy|sell)\b",
    r"\b(?:buy|sell)\s+\d{2,3}\s*%",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in PROHIBITED_PATTERNS]


def _walk_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        out: list[str] = []
        for v in value.values():
            out.extend(_walk_strings(v))
        return out
    if isinstance(value, (list, tuple)):
        out = []
        for v in value:
            out.extend(_walk_strings(v))
        return out
    return []


def find_prohibited(text_or_obj: Any) -> list[str]:
    hits: list[str] = []
    for text in _walk_strings(text_or_obj):
        for rx in _COMPILED:
            if rx.search(text):
                hits.append(rx.pattern)
    return hits


def contains_prohibited(text_or_obj: Any) -> bool:
    return bool(find_prohibited(text_or_obj))
