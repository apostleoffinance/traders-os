from __future__ import annotations

from enum import StrEnum


class Direction(StrEnum):
    LONG = "long"
    SHORT = "short"


class TradeStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class TradeResult(StrEnum):
    OPEN = "open"
    WIN = "win"
    LOSS = "loss"
    BREAKEVEN = "breakeven"


class SessionName(StrEnum):
    ASIA = "asia"
    LONDON = "london"
    NEW_YORK = "new_york"
    LONDON_NY_OVERLAP = "london_ny_overlap"
    OUTSIDE = "outside"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    BLOWN = "blown"
    PASSED = "passed"
    CLOSED = "closed"


class ScreenshotType(StrEnum):
    ENTRY = "entry"
    EXIT = "exit"
    OTHER = "other"


class RiskStatus(StrEnum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class RiskEventType(StrEnum):
    RISK_PER_TRADE_EXCEEDED = "risk_per_trade_exceeded"
    RISK_PER_TRADE_HARD_BLOCK = "risk_per_trade_hard_block"
    DAILY_LOSS_APPROACHING = "daily_loss_approaching"
    DAILY_LOSS_EXCEEDED = "daily_loss_exceeded"
    FIRM_DAILY_DRAWDOWN_APPROACHING = "firm_daily_drawdown_approaching"
    FIRM_DAILY_DRAWDOWN_EXCEEDED = "firm_daily_drawdown_exceeded"
    PERSONAL_DRAWDOWN_APPROACHING = "personal_drawdown_approaching"
    PERSONAL_DRAWDOWN_EXCEEDED = "personal_drawdown_exceeded"
    FIRM_MAX_DRAWDOWN_APPROACHING = "firm_max_drawdown_approaching"
    FIRM_MAX_DRAWDOWN_EXCEEDED = "firm_max_drawdown_exceeded"
    MAX_TRADES_PER_DAY = "max_trades_per_day"
    CONSECUTIVE_LOSSES = "consecutive_losses"
    RISK_ESCALATION = "risk_escalation"
    REVENGE_TRADE = "revenge_trade"
    OUTSIDE_PREFERRED_SESSION = "outside_preferred_session"
    FREQUENCY_SPIKE = "frequency_spike"
    EMOTIONAL_DETERIORATION = "emotional_deterioration"
    RR_BELOW_MINIMUM = "rr_below_minimum"
    CHECKLIST_INCOMPLETE = "checklist_incomplete"


class ChecklistCategory(StrEnum):
    MARKET_CONTEXT = "market_context"
    SETUP_CONFIRMATION = "setup_confirmation"
    RISK = "risk"
    PSYCHOLOGY = "psychology"
    EXECUTION = "execution"


class ChecklistItemKind(StrEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class AutoCheckKey(StrEnum):
    RISK_PER_TRADE = "risk_per_trade"
    PLANNED_RR = "planned_rr"
    SESSION = "session"
    DAILY_LOSS = "daily_loss"
    TRADES_TODAY = "trades_today"
    DRAWDOWN = "drawdown"
    SL_DEFINED = "sl_defined"
    TP_DEFINED = "tp_defined"


class ProcessStatus(StrEnum):
    VALID = "valid"
    WARNING = "warning"
    BLOCKED = "blocked"
    INCOMPLETE = "incomplete"


class EnforcementMode(StrEnum):
    WARN = "warn"
    CONFIRM = "confirm"
    BLOCK = "block"


class DrawdownBasis(StrEnum):
    STARTING_BALANCE = "starting_balance"
    HIGH_WATER_MARK = "high_water_mark"


class Emotion(StrEnum):
    CALM = "calm"
    CONFIDENT = "confident"
    FEARFUL = "fearful"
    FOMO = "fomo"
    FRUSTRATED = "frustrated"
    REVENGE = "revenge"
    BORED = "bored"
    NEUTRAL = "neutral"
    ANXIOUS = "anxious"
    EUPHORIC = "euphoric"


class Timeframe(StrEnum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"
    W1 = "W1"


class AssetClass(StrEnum):
    FX = "fx"
    CRYPTO = "crypto"
    COMMODITY = "commodity"
    INDEX = "index"


class TradeSource(StrEnum):
    MANUAL = "manual"
    MARKET_ANALYSIS = "market_analysis"
    IMPORTED = "imported"
    MT5 = "mt5"


class Mt5ConnectionStatus(StrEnum):
    PENDING = "pending"
    CONNECTED = "connected"
    STALE = "stale"
    DISCONNECTED = "disconnected"
    REVOKED = "revoked"


class InstrumentResolution(StrEnum):
    RESOLVED = "resolved"
    UNRESOLVED = "unresolved"


class AnalysisStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"
    EXECUTED = "executed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    REVIEWED = "reviewed"


class AnnotationType(StrEnum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    TREND = "trend"
    ZONE = "zone"
    TEXT = "text"
    LIQUIDITY = "liquidity"
    SWING_HIGH = "swing_high"
    SWING_LOW = "swing_low"
    SUPPORT = "support"
    RESISTANCE = "resistance"
    STRUCTURE_BREAK = "structure_break"
    CHOCH = "choch"
    LIQUIDITY_SWEEP = "liquidity_sweep"
    REJECTION = "rejection"
    ENTRY = "entry"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    CUSTOM = "custom"


class DataFreshness(StrEnum):
    HISTORICAL = "historical"
    DELAYED = "delayed"
    CACHED = "cached"
    STALE = "stale"
