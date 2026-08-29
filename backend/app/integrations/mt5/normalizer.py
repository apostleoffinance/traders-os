"""MT5 broker symbol → Trader OS instrument catalog."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.enums import InstrumentResolution
from app.engines.fx_math import UnknownSymbolError, get_instrument, normalize_symbol

# Common MT5 broker suffixes (longest first).
_SUFFIXES = (
    ".PRO",
    ".pro",
    ".RAW",
    ".raw",
    ".ECN",
    ".ecn",
    ".A",
    ".a",
    ".M",
    ".m",
    "#",
    "+",
    "M",
    "I",
)


@dataclass(frozen=True)
class SymbolResolution:
    symbol_raw: str
    symbol: str
    instrument_status: InstrumentResolution


def resolve_mt5_symbol(symbol_raw: str) -> SymbolResolution:
    raw = symbol_raw.strip()
    if not raw:
        return SymbolResolution("", "", InstrumentResolution.UNRESOLVED)

    candidates: list[str] = []
    base = normalize_symbol(raw)
    candidates.append(base)

    upper = raw.upper()
    for suffix in _SUFFIXES:
        if upper.endswith(suffix.upper()):
            trimmed = upper[: -len(suffix)]
            candidates.append(normalize_symbol(trimmed))

    # Heuristic: strip trailing single non-alpha char (e.g. EURUSD.)
    if len(base) > 4 and not base[-1].isalpha():
        candidates.append(base[:-1])

    seen: set[str] = set()
    for candidate in candidates:
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        try:
            get_instrument(candidate)
            return SymbolResolution(raw, candidate, InstrumentResolution.RESOLVED)
        except UnknownSymbolError:
            continue

    return SymbolResolution(raw, base, InstrumentResolution.UNRESOLVED)
