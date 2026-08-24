from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum


class CalcMode(StrEnum):
    """Calculation modes. Default for experienced traders: fixed risk + SL → size."""

    RISK_TO_LEVELS = "risk_to_levels"  # risk + reward $ + lot → SL/TP
    ENTRY_SL_TO_SIZE = "entry_sl_to_size"  # entry + SL + risk → size
    TRADE_ANALYSIS = "trade_analysis"  # entry + SL + TP + lot → risk/reward
    TARGET_DISTANCE = "target_distance"  # lot + target $ → TP
    FIXED_RISK_SL = "fixed_risk_sl"  # alias of ENTRY_SL_TO_SIZE (default)


@dataclass
class CalculatorInput:
    mode: CalcMode
    symbol: str
    direction: str  # long | short
    entry: Decimal
    account_balance: Decimal
    quote_to_account_rate: Decimal
    lot_size: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    risk_amount: Decimal | None = None
    reward_amount: Decimal | None = None
    risk_percent: Decimal | None = None  # alternative to risk_amount


@dataclass
class CalculatorResult:
    ok: bool
    mode: str
    symbol: str
    direction: str
    entry: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    lot_size: Decimal | None = None
    size_unit: str = "lots"
    stop_distance: Decimal | None = None
    tp_distance: Decimal | None = None
    stop_pips: Decimal | None = None
    tp_pips: Decimal | None = None
    risk_amount: Decimal | None = None
    requested_risk: Decimal | None = None
    risk_difference: Decimal | None = None
    reward_amount: Decimal | None = None
    planned_rr: Decimal | None = None
    risk_percent: Decimal | None = None
    conversion_rate: Decimal | None = None
    errors: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        def d(v: Decimal | None):
            return str(v) if v is not None else None

        return {
            "ok": self.ok,
            "mode": self.mode,
            "symbol": self.symbol,
            "direction": self.direction,
            "entry": d(self.entry),
            "stop_loss": d(self.stop_loss),
            "take_profit": d(self.take_profit),
            "lot_size": d(self.lot_size),
            "size_unit": self.size_unit,
            "stop_distance": d(self.stop_distance),
            "tp_distance": d(self.tp_distance),
            "stop_pips": d(self.stop_pips),
            "tp_pips": d(self.tp_pips),
            "risk_amount": d(self.risk_amount),
            "requested_risk": d(self.requested_risk),
            "risk_difference": d(self.risk_difference),
            "reward_amount": d(self.reward_amount),
            "planned_rr": d(self.planned_rr),
            "risk_percent": d(self.risk_percent),
            "conversion_rate": d(self.conversion_rate),
            "errors": self.errors,
            "notes": self.notes,
        }
