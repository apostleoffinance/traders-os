"""Repair risk/R metrics on MT5-synced trades left zeroed by a transient FX-conversion failure.

USD-quoted pairs (e.g. EURUSD) need no conversion rate, so they always compute correctly.
Cross/JPY pairs need a live or cached quote; when that lookup failed at sync time, the trade
was persisted with risk_amount=0 and no R-multiple. This recomputes those fields once a rate
becomes available, without re-deriving anything sync already computed successfully.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import Direction, InstrumentResolution, TradeStatus
from app.engines.fx_math import UnknownSymbolError, planned_metrics, realized_r
from app.models.account import Account
from app.models.trade import Trade

log = logging.getLogger(__name__)


def backfill_risk_metrics_for_trade(db: Session, trade: Trade, account: Account) -> bool:
    """Recompute risk/R fields for a trade stuck at zero risk_amount. Returns True if updated."""
    if trade.instrument_status != InstrumentResolution.RESOLVED.value:
        return False
    if trade.risk_amount not in (None, Decimal("0")):
        return False
    if trade.entry_price is None or trade.stop_loss is None or trade.lot_size is None:
        return False

    from app.market_data.service import conversion_rate

    try:
        conversion = conversion_rate(db, trade.symbol, account.currency, allow_stale=True)
    except Exception as exc:
        log.info("risk metrics backfill: rate still unavailable trade=%s symbol=%s: %s", trade.id, trade.symbol, exc)
        return False

    raw_rate = conversion.get("rate")
    if raw_rate is None:
        return False
    rate = Decimal(str(raw_rate))

    balance = Decimal(account.current_equity or account.starting_balance)
    try:
        metrics = planned_metrics(
            symbol=trade.symbol,
            direction=Direction(trade.direction),
            entry=Decimal(trade.entry_price),
            stop_loss=Decimal(trade.stop_loss),
            take_profit=Decimal(trade.take_profit) if trade.take_profit is not None else None,
            lot_size=Decimal(trade.lot_size),
            account_balance=balance,
            quote_to_account_rate=rate,
        )
    except UnknownSymbolError:
        return False

    if metrics["risk_amount"] <= Decimal("0"):
        return False

    trade.stop_pips = metrics["stop_pips"]
    trade.tp_pips = metrics["tp_pips"]
    trade.risk_amount = metrics["risk_amount"]
    trade.risk_percent = metrics["risk_percent"]
    trade.planned_reward = metrics["planned_reward"]
    trade.planned_rr = metrics["planned_rr"]

    if trade.status == TradeStatus.CLOSED.value and trade.realized_pnl is not None:
        r = realized_r(Decimal(trade.realized_pnl), metrics["risk_amount"])
        trade.realized_r = r
        trade.realized_rr = r

    log.info("risk metrics backfilled trade=%s symbol=%s risk_amount=%s", trade.id, trade.symbol, trade.risk_amount)
    return True
