"""Normalized trade row for Analytics Lab calculations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Sequence

if TYPE_CHECKING:
    from app.engines.analytics_views import JournalTrade

from app.core.enums import TradeResult, TradeStatus
from app.engines.fx_math import ZERO
from app.models.trade import Trade

BREAKEVEN_EPS = Decimal("0.01")


@dataclass(frozen=True)
class ChecklistItemSnapshot:
    item_id: str
    label: str
    category: str
    required: bool
    checked: bool


@dataclass(frozen=True)
class AnalyticsTrade:
    """Canonical analytics trade with cost fields.

  Sign convention (MT5-aligned):
  - realized_pnl (net): broker profit + commission + swap
  - commission, swap: stored as MT5 reports (typically negative for costs)
  - gross_pnl: trading profit before commission and swap
      gross_pnl = realized_pnl - commission - swap
  - trading_cost: economic cost magnitude = -(commission + swap) when costs are negative
    """

    id: str
    symbol: str
    direction: str
    session: str
    setup: str
    setup_id: str | None
    timeframe: str
    entry_at: datetime
    exit_at: datetime | None
    entry_price: Decimal
    exit_price: Decimal | None
    lot_size: Decimal
    risk_amount: Decimal
    risk_percent: Decimal
    commission: Decimal
    swap: Decimal
    realized_pnl: Decimal
    realized_r: Decimal | None
    holding_time_seconds: int | None
    mfe_price: Decimal | None
    mae_price: Decimal | None
    mfe_r: Decimal | None
    mae_r: Decimal | None
    mfe_mae_source: str | None
    result: TradeResult
    status: TradeStatus
    emotion_before: str | None
    # Phase 3 behaviour fields
    emotion_during: str | None = None
    emotion_after: str | None = None
    discipline_score: int | None = None
    setup_valid: bool = True
    rules_followed: bool = True
    emotional_trade: bool = False
    mistake: bool = False
    in_preferred_session: bool = True
    checklist_checked: int = 0
    checklist_total: int = 0
    fomo: int = 0
    fear: int = 0
    frustration: int = 0
    revenge_intensity: int = 0
    boredom: int = 0
    confidence: int = 0
    checklist_items: tuple[ChecklistItemSnapshot, ...] = ()

    @property
    def gross_pnl(self) -> Decimal:
        return self.realized_pnl - self.commission - self.swap

    @property
    def trading_cost(self) -> Decimal:
        """Absolute economic cost (commission + swap as positive drag)."""
        return -(self.commission + self.swap)

    @property
    def net_pnl(self) -> Decimal:
        return self.realized_pnl

    @property
    def r_multiple(self) -> Decimal | None:
        if self.realized_r is not None:
            return self.realized_r
        if self.risk_amount > ZERO:
            return self.realized_pnl / self.risk_amount
        return None

    def classify_outcome(self) -> str:
        if abs(self.net_pnl) <= BREAKEVEN_EPS:
            return "breakeven"
        if self.net_pnl > ZERO:
            return "win"
        return "loss"


def trade_to_analytics(trade: Trade) -> AnalyticsTrade:
    commission = Decimal(trade.commission or 0)
    swap = Decimal(trade.swap or 0)
    psy = trade.psychology
    responses = getattr(trade, "checklist_responses", None) or []
    checked = sum(1 for r in responses if r.checked)
    total = len(responses)
    item_snaps: list[ChecklistItemSnapshot] = []
    for r in responses:
        item = getattr(r, "item", None)
        if item is None:
            continue
        item_snaps.append(
            ChecklistItemSnapshot(
                item_id=str(r.item_id),
                label=item.label,
                category=item.category,
                required=bool(item.required),
                checked=bool(r.checked),
            )
        )
    return AnalyticsTrade(
        id=str(trade.id),
        symbol=trade.symbol,
        direction=trade.direction,
        session=trade.session,
        setup=trade.setup.name if trade.setup else "unclassified",
        setup_id=str(trade.setup_id) if trade.setup_id else None,
        timeframe=trade.timeframe,
        entry_at=trade.trade_timestamp,
        exit_at=trade.exit_timestamp,
        entry_price=Decimal(trade.entry_price),
        exit_price=Decimal(trade.exit_price) if trade.exit_price is not None else None,
        lot_size=Decimal(trade.lot_size),
        risk_amount=Decimal(trade.risk_amount or 0),
        risk_percent=Decimal(trade.risk_percent or 0),
        commission=commission,
        swap=swap,
        realized_pnl=Decimal(trade.realized_pnl or 0),
        realized_r=Decimal(trade.realized_r) if trade.realized_r is not None else None,
        holding_time_seconds=trade.holding_time_seconds,
        mfe_price=Decimal(trade.mfe_price) if getattr(trade, "mfe_price", None) is not None else None,
        mae_price=Decimal(trade.mae_price) if getattr(trade, "mae_price", None) is not None else None,
        mfe_r=Decimal(trade.mfe_r) if getattr(trade, "mfe_r", None) is not None else None,
        mae_r=Decimal(trade.mae_r) if getattr(trade, "mae_r", None) is not None else None,
        mfe_mae_source=getattr(trade, "mfe_mae_source", None),
        result=TradeResult(trade.result),
        status=TradeStatus(trade.status),
        emotion_before=psy.emotion_before if psy else None,
        emotion_during=psy.emotion_during if psy else None,
        emotion_after=psy.emotion_after if psy else None,
        discipline_score=getattr(trade, "discipline_score", None),
        setup_valid=bool(getattr(trade, "setup_valid", True)),
        rules_followed=bool(getattr(trade, "rules_followed", True)),
        emotional_trade=bool(getattr(trade, "emotional_trade", False)),
        mistake=bool(getattr(trade, "mistake", False)),
        in_preferred_session=bool(getattr(trade, "in_preferred_session", True)),
        checklist_checked=checked,
        checklist_total=total,
        fomo=psy.fomo if psy else 0,
        fear=psy.fear if psy else 0,
        frustration=psy.frustration if psy else 0,
        revenge_intensity=psy.revenge if psy else 0,
        boredom=psy.boredom if psy else 0,
        confidence=psy.confidence if psy else 0,
        checklist_items=tuple(item_snaps),
    )


def closed_trades(rows: list[AnalyticsTrade]) -> list[AnalyticsTrade]:
    return [t for t in rows if t.status == TradeStatus.CLOSED]


def ordered_closed(rows: Sequence[AnalyticsTrade]) -> list[AnalyticsTrade]:
    from app.core.time import as_utc

    closed = closed_trades(list(rows))
    return sorted(closed, key=lambda t: as_utc(t.exit_at or t.entry_at))


def _canonical_result(t: AnalyticsTrade) -> TradeResult:
    outcome = t.classify_outcome()
    if outcome == "win":
        return TradeResult.WIN
    if outcome == "loss":
        return TradeResult.LOSS
    return TradeResult.BREAKEVEN


def to_journal_trade(t: AnalyticsTrade) -> "JournalTrade":
    from app.engines.analytics_views import JournalTrade

    return JournalTrade(
        id=t.id,
        symbol=t.symbol,
        session=t.session,
        setup=t.setup,
        direction=t.direction,
        timeframe=t.timeframe,
        result=_canonical_result(t),
        status=t.status,
        entry_at=t.entry_at,
        exit_at=t.exit_at,
        risk_amount=t.risk_amount,
        risk_percent=t.risk_percent,
        realized_pnl=t.net_pnl,
        realized_r=t.r_multiple,
        holding_time_seconds=t.holding_time_seconds,
        emotion_before=t.emotion_before,
        discipline_score=t.discipline_score,
    )


def journal_rows(rows: Sequence[AnalyticsTrade]) -> list["JournalTrade"]:
    return [to_journal_trade(t) for t in rows]
