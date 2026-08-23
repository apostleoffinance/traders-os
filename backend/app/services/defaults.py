from __future__ import annotations

from decimal import Decimal
from typing import TypedDict

from app.core.enums import AutoCheckKey, ChecklistCategory, ChecklistItemKind

DEFAULT_SETUPS: list[dict[str, str]] = [
    {"name": "Liquidity Sweep", "description": "Classification only — not a profitability claim."},
    {"name": "Structure Break", "description": "Classification only — not a profitability claim."},
    {"name": "Retest", "description": "Classification only — not a profitability claim."},
    {"name": "Breakout", "description": "Classification only — not a profitability claim."},
    {"name": "Support/Resistance", "description": "Classification only — not a profitability claim."},
    {"name": "Other", "description": "Unclassified or mixed setup."},
]


class ChecklistItemSpec(TypedDict, total=False):
    label: str
    category: str
    kind: str
    auto_key: str | None
    required: bool
    description: str | None


CATEGORY_ORDER: tuple[str, ...] = (
    ChecklistCategory.MARKET_CONTEXT.value,
    ChecklistCategory.SETUP_CONFIRMATION.value,
    ChecklistCategory.RISK.value,
    ChecklistCategory.PSYCHOLOGY.value,
    ChecklistCategory.EXECUTION.value,
)

CATEGORY_LABELS: dict[str, str] = {
    ChecklistCategory.MARKET_CONTEXT.value: "Market context",
    ChecklistCategory.SETUP_CONFIRMATION.value: "Setup confirmation",
    ChecklistCategory.RISK.value: "Risk management",
    ChecklistCategory.PSYCHOLOGY.value: "Psychology",
    ChecklistCategory.EXECUTION.value: "Execution",
}

AUTO_CHECK_SPECS: list[ChecklistItemSpec] = [
    {
        "label": "Trading session",
        "category": ChecklistCategory.MARKET_CONTEXT.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.SESSION.value,
        "required": False,
        "description": "Classified from the trade timestamp. Not a profitability claim.",
    },
    {
        "label": "Risk within configured maximum",
        "category": ChecklistCategory.RISK.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.RISK_PER_TRADE.value,
        "required": True,
        "description": "Compared to the account risk-per-trade policy by the risk engine.",
    },
    {
        "label": "Planned R:R meets configured minimum",
        "category": ChecklistCategory.RISK.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.PLANNED_RR.value,
        "required": True,
        "description": "Planned reward ÷ planned risk vs the account minimum.",
    },
    {
        "label": "Daily risk available",
        "category": ChecklistCategory.RISK.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.DAILY_LOSS.value,
        "required": True,
        "description": "Remaining personal daily loss capacity after this planned risk.",
    },
    {
        "label": "Trades today within limit",
        "category": ChecklistCategory.RISK.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.TRADES_TODAY.value,
        "required": True,
        "description": "Count of trades already logged today vs the account maximum.",
    },
    {
        "label": "Drawdown within limits",
        "category": ChecklistCategory.RISK.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.DRAWDOWN.value,
        "required": True,
        "description": "Current drawdown vs the personal maximum.",
    },
    {
        "label": "Stop-loss defined",
        "category": ChecklistCategory.EXECUTION.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.SL_DEFINED.value,
        "required": True,
        "description": "A stop-loss price is present on the ticket.",
    },
    {
        "label": "Take-profit defined",
        "category": ChecklistCategory.EXECUTION.value,
        "kind": ChecklistItemKind.AUTOMATIC.value,
        "auto_key": AutoCheckKey.TP_DEFINED.value,
        "required": False,
        "description": "A take-profit price is present on the ticket.",
    },
]

SHARED_MANUAL_SPECS: list[ChecklistItemSpec] = [
    {
        "label": "Emotionally stable",
        "category": ChecklistCategory.PSYCHOLOGY.value,
        "kind": ChecklistItemKind.MANUAL.value,
        "auto_key": None,
        "required": True,
        "description": "You reviewed your state. Not a prediction of the outcome.",
    },
    {
        "label": "No FOMO",
        "category": ChecklistCategory.PSYCHOLOGY.value,
        "kind": ChecklistItemKind.MANUAL.value,
        "auto_key": None,
        "required": True,
        "description": None,
    },
    {
        "label": "No revenge trading",
        "category": ChecklistCategory.PSYCHOLOGY.value,
        "kind": ChecklistItemKind.MANUAL.value,
        "auto_key": None,
        "required": True,
        "description": None,
    },
    {
        "label": "Entry planned",
        "category": ChecklistCategory.EXECUTION.value,
        "kind": ChecklistItemKind.MANUAL.value,
        "auto_key": None,
        "required": True,
        "description": None,
    },
    {
        "label": "Position size verified",
        "category": ChecklistCategory.EXECUTION.value,
        "kind": ChecklistItemKind.MANUAL.value,
        "auto_key": None,
        "required": True,
        "description": None,
    },
]

_M = ChecklistItemKind.MANUAL.value
_CTX = ChecklistCategory.MARKET_CONTEXT.value
_SETUP = ChecklistCategory.SETUP_CONFIRMATION.value


def _manual(label: str, category: str, required: bool = True) -> ChecklistItemSpec:
    return {
        "label": label,
        "category": category,
        "kind": _M,
        "auto_key": None,
        "required": required,
        "description": None,
    }


SETUP_MANUAL_SPECS: dict[str, list[ChecklistItemSpec]] = {
    "Liquidity Sweep": [
        _manual("Liquidity identified", _CTX),
        _manual("Key level identified", _CTX),
        _manual("Liquidity swept", _SETUP),
        _manual("Rejection confirmed", _SETUP),
        _manual("Structure confirmed", _SETUP),
        _manual("Entry condition confirmed", _SETUP),
    ],
    "Structure Break": [
        _manual("Key level identified", _CTX),
        _manual("Higher-timeframe context aligned", _CTX),
        _manual("Structure break confirmed", _SETUP),
        _manual("Displacement confirmed", _SETUP),
        _manual("Entry condition confirmed", _SETUP),
    ],
    "Retest": [
        _manual("Key level identified", _CTX),
        _manual("Level retested", _SETUP),
        _manual("Rejection confirmed", _SETUP),
        _manual("Entry condition confirmed", _SETUP),
    ],
    "Breakout": [
        _manual("Range or level identified", _CTX),
        _manual("Breakout confirmed", _SETUP),
        _manual("Close beyond level", _SETUP),
        _manual("Entry condition confirmed", _SETUP),
    ],
    "Support/Resistance": [
        _manual("Key level identified", _CTX),
        _manual("Reaction at level", _SETUP),
        _manual("Entry condition confirmed", _SETUP),
    ],
    "Other": [
        _manual("Market context reviewed", _CTX, required=False),
        _manual("Setup condition confirmed", _SETUP),
    ],
}


def items_for_setup(setup_name: str | None) -> list[ChecklistItemSpec]:
    """Ordered process items for a setup. Never includes an instrument name."""
    manuals = list(SETUP_MANUAL_SPECS.get(setup_name or "", SETUP_MANUAL_SPECS["Other"]))
    combined = [*AUTO_CHECK_SPECS, *SHARED_MANUAL_SPECS, *manuals]
    rank = {key: i for i, key in enumerate(CATEGORY_ORDER)}
    kind_rank = {ChecklistItemKind.AUTOMATIC.value: 0, ChecklistItemKind.MANUAL.value: 1}
    combined.sort(
        key=lambda spec: (
            rank.get(spec["category"], 99),
            kind_rank.get(spec["kind"], 9),
            spec["label"],
        )
    )
    return combined


# Legacy label list for migrations / library fallback. Instrument is not a check.
DEFAULT_CHECKLIST: list[str] = [
    spec["label"] for spec in items_for_setup(None) if spec["kind"] == ChecklistItemKind.MANUAL.value
]

LEGACY_ITEM_MAP: dict[str, ChecklistItemSpec] = {
    "valid trading session": AUTO_CHECK_SPECS[0],
    "liquidity identified": _manual("Liquidity identified", _CTX),
    "liquidity swept": _manual("Liquidity swept", _SETUP),
    "rejection confirmed": _manual("Rejection confirmed", _SETUP),
    "structure confirmation": _manual("Structure confirmed", _SETUP),
    "valid entry": _manual("Entry condition confirmed", _SETUP),
    "risk <= configured maximum": next(
        s for s in AUTO_CHECK_SPECS if s["auto_key"] == AutoCheckKey.RISK_PER_TRADE.value
    ),
    "planned r:r >= configured minimum": next(
        s for s in AUTO_CHECK_SPECS if s["auto_key"] == AutoCheckKey.PLANNED_RR.value
    ),
    "no daily risk violation": next(
        s for s in AUTO_CHECK_SPECS if s["auto_key"] == AutoCheckKey.DAILY_LOSS.value
    ),
    "trader emotionally stable": SHARED_MANUAL_SPECS[0],
}

DEFAULT_PREFERRED_WINDOWS = [
    {"name": "london_morning", "timezone": "Africa/Lagos", "start": "08:00", "end": "11:00"},
    {"name": "london_ny_overlap", "timezone": "Africa/Lagos", "start": "13:00", "end": "16:00"},
]

TENTRADE_TENEDGE_1K = {
    "firm": "TenTrade",
    "program": "TenEdge Instant",
    "account_name": "TenTrade TenEdge Instant $1K",
    "currency": "USD",
    "starting_balance": Decimal("1000.00"),
    "risk_profile": {
        "risk_per_trade": Decimal("5.00"),
        "personal_daily_loss_limit": Decimal("10.00"),
        "personal_max_drawdown": Decimal("50.00"),
        "firm_daily_drawdown_limit": Decimal("60.00"),
        "firm_max_drawdown_limit": Decimal("90.00"),
        "max_trades_per_day": 2,
        "preferred_min_rr": Decimal("1.50"),
        "preferred_rr": Decimal("2.00"),
        "minimum_trading_days": 5,
        "hard_risk_per_trade": Decimal("10.00"),
        "preferred_windows": DEFAULT_PREFERRED_WINDOWS,
        "notes": "Personal limits are stricter than TenTrade stated limits.",
    },
}

ACCOUNT_TEMPLATES = {
    "tentrade_tenedge_1k": TENTRADE_TENEDGE_1K,
}
