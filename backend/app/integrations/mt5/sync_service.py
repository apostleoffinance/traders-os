from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import Direction, InstrumentResolution, Mt5ConnectionStatus, TradeSource, TradeStatus
from app.core.time import as_utc, utcnow
from app.engines.fx_math import (
    UnknownSymbolError,
    classify_result,
    get_instrument,
    holding_seconds,
    planned_metrics,
    realized_r,
)
from app.engines.session_engine import classify_session, in_preferred_window
from app.integrations.mt5.normalizer import resolve_mt5_symbol
from app.integrations.mt5.schemas import Mt5DealIn, Mt5PositionIn, Mt5SyncIn, Mt5SyncOut
from app.models.account import Account
from app.models.mt5_connection import Mt5Connection, Mt5ProcessedDeal
from app.models.trade import Trade
from app.models.user import User
from app.services.account_service import refresh_account_balances
from app.services.mapping import parse_windows

logger = logging.getLogger(__name__)

PROVIDER = "mt5"
PIP_OFFSET = 10


@dataclass
class SyncCounters:
    created: int = 0
    updated: int = 0
    closed: int = 0


def apply_sync(db: Session, connection: Mt5Connection, payload: Mt5SyncIn) -> Mt5SyncOut:
    user = db.query(User).filter(User.id == connection.user_id).one()
    account = db.query(Account).filter(Account.id == connection.account_id).one()
    now = utcnow()

    connection.last_seen_at = now
    if payload.event_type == "sync":
        connection.last_sync_at = now
    if payload.account is not None:
        connection.mt5_login = str(payload.account.login)
        connection.mt5_server = payload.account.server
        connection.broker_name = payload.account.company
    if connection.status in {Mt5ConnectionStatus.PENDING.value, Mt5ConnectionStatus.DISCONNECTED.value}:
        connection.status = Mt5ConnectionStatus.CONNECTED.value

    counters = SyncCounters()
    if payload.event_type == "heartbeat":
        db.commit()
        return Mt5SyncOut(
            success=True,
            connection_status=Mt5ConnectionStatus.CONNECTED.value,
            server_time=now,
        )

    open_ids: set[str] = set()
    for position in payload.positions:
        open_ids.add(position.external_position_id)
        _upsert_open_position(db, user, account, connection, position, counters)

    for deal in payload.recent_deals:
        if deal.entry_type in {"OUT", "OUT_BY", "INOUT"}:
            _close_from_deal(db, user, account, connection, deal, counters)

    _reconcile_missing_positions(db, account, open_ids, counters)

    refresh_account_balances(db, account)
    db.commit()

    logger.info(
        "MT5 snapshot applied connection_id=%s created=%s updated=%s closed=%s",
        connection.id,
        counters.created,
        counters.updated,
        counters.closed,
    )
    return Mt5SyncOut(
        success=True,
        connection_status=Mt5ConnectionStatus.CONNECTED.value,
        trades_created=counters.created,
        trades_updated=counters.updated,
        trades_closed=counters.closed,
        server_time=now,
    )


def _find_mt5_trade(db: Session, account_id: UUID, position_id: str) -> Trade | None:
    return (
        db.query(Trade)
        .filter(
            Trade.account_id == account_id,
            Trade.external_provider == PROVIDER,
            Trade.external_position_id == position_id,
        )
        .one_or_none()
    )


def _effective_stop_loss(
    symbol: str,
    direction: Direction,
    entry: Decimal,
    broker_sl: Decimal | None,
) -> Decimal:
    if broker_sl is not None and broker_sl > 0:
        return broker_sl
    try:
        pip = get_instrument(symbol).pip_size
    except UnknownSymbolError:
        pip = Decimal("0.0001")
    offset = pip * PIP_OFFSET
    if direction == Direction.LONG:
        return entry - offset
    return entry + offset


def _compute_sync_metrics(
    *,
    symbol: str,
    resolved: bool,
    direction: Direction,
    entry: Decimal,
    stop_loss: Decimal | None,
    take_profit: Decimal | None,
    lot_size: Decimal,
    account: Account,
    exit_price: Decimal | None = None,
    broker_pnl: Decimal | None = None,
) -> dict:
    sl = _effective_stop_loss(symbol, direction, entry, stop_loss)
    tp = take_profit if take_profit and take_profit > 0 else None
    rate = Decimal("1")
    balance = Decimal(account.current_equity or account.starting_balance)

    if resolved:
        try:
            metrics = planned_metrics(
                symbol=symbol,
                direction=direction,
                entry=entry,
                stop_loss=sl,
                take_profit=tp,
                lot_size=lot_size,
                account_balance=balance,
                quote_to_account_rate=rate,
            )
        except UnknownSymbolError:
            resolved = False
            metrics = _zero_metrics(lot_size, balance)
    else:
        metrics = _zero_metrics(lot_size, balance)

    pnl = broker_pnl
    r_mult = None
    if pnl is not None and metrics["risk_amount"] > 0:
        r_mult = realized_r(pnl, metrics["risk_amount"])
    status = TradeStatus.CLOSED if exit_price is not None else TradeStatus.OPEN
    result = classify_result(status, pnl)
    return {
        "metrics": metrics,
        "sl": sl,
        "tp": tp,
        "pnl": pnl,
        "r": r_mult,
        "status": status,
        "result": result,
    }


def _zero_metrics(lot_size: Decimal, balance: Decimal) -> dict:
    return {
        "stop_pips": Decimal("0"),
        "tp_pips": None,
        "risk_amount": Decimal("0"),
        "risk_percent": Decimal("0"),
        "planned_reward": None,
        "planned_rr": None,
    }


def _apply_mt5_fields(
    trade: Trade,
    *,
    symbol: str,
    symbol_raw: str,
    instrument_status: InstrumentResolution,
    direction: Direction,
    entry: Decimal,
    stop_loss: Decimal | None,
    take_profit: Decimal | None,
    lot_size: Decimal,
    opened_at: datetime,
    account: Account,
    exit_price: Decimal | None = None,
    exit_at: datetime | None = None,
    broker_pnl: Decimal | None = None,
    commission: Decimal | None = None,
    swap: Decimal | None = None,
) -> None:
    resolved = instrument_status == InstrumentResolution.RESOLVED
    computed = _compute_sync_metrics(
        symbol=symbol,
        resolved=resolved,
        direction=direction,
        entry=entry,
        stop_loss=stop_loss,
        take_profit=take_profit,
        lot_size=lot_size,
        account=account,
        exit_price=exit_price,
        broker_pnl=broker_pnl,
    )
    session = classify_session(opened_at)
    windows = parse_windows(account.risk_profile.preferred_windows if account.risk_profile else None)
    preferred = in_preferred_window(opened_at, windows)

    trade.symbol = symbol
    trade.symbol_raw = symbol_raw
    trade.instrument_status = instrument_status.value
    trade.direction = direction.value
    trade.entry_price = entry
    trade.stop_loss = computed["sl"]
    trade.take_profit = computed["tp"]
    trade.lot_size = lot_size
    trade.trade_timestamp = as_utc(opened_at)
    trade.session = session.value
    trade.in_preferred_session = preferred
    trade.stop_pips = computed["metrics"]["stop_pips"]
    trade.tp_pips = computed["metrics"]["tp_pips"]
    trade.risk_amount = computed["metrics"]["risk_amount"]
    trade.risk_percent = computed["metrics"]["risk_percent"]
    trade.planned_reward = computed["metrics"]["planned_reward"]
    trade.planned_rr = computed["metrics"]["planned_rr"]
    trade.status = computed["status"].value
    trade.result = computed["result"].value
    if commission is not None:
        trade.commission = commission
    if swap is not None:
        trade.swap = swap
    if exit_price is not None:
        trade.exit_price = exit_price
        trade.exit_timestamp = exit_at
        trade.realized_pnl = computed["pnl"]
        trade.realized_r = computed["r"]
        trade.realized_rr = computed["r"]
        trade.holding_time_seconds = holding_seconds(as_utc(opened_at), as_utc(exit_at))


def _upsert_open_position(
    db: Session,
    user: User,
    account: Account,
    connection: Mt5Connection,
    position: Mt5PositionIn,
    counters: SyncCounters,
) -> Trade:
    resolution = resolve_mt5_symbol(position.symbol_raw)
    direction = Direction.LONG if position.direction == "LONG" else Direction.SHORT
    opened_at = as_utc(position.opened_at)

    trade = _find_mt5_trade(db, account.id, position.external_position_id)
    if trade is None:
        trade = Trade(
            user_id=user.id,
            account_id=account.id,
            timezone=user.timezone,
            timeframe="M15",
            source=TradeSource.MT5.value,
            external_provider=PROVIDER,
            external_position_id=position.external_position_id,
            setup_valid=True,
            rules_followed=True,
            emotional_trade=False,
            mistake=False,
            acknowledged_warnings=True,
        )
        db.add(trade)
        counters.created += 1
        logger.info("MT5 position created trade position_id=%s", position.external_position_id)
    else:
        counters.updated += 1
        logger.info("MT5 position updated trade position_id=%s", position.external_position_id)

    _apply_mt5_fields(
        trade,
        symbol=resolution.symbol,
        symbol_raw=resolution.symbol_raw,
        instrument_status=resolution.instrument_status,
        direction=direction,
        entry=position.entry_price,
        stop_loss=position.stop_loss,
        take_profit=position.take_profit,
        lot_size=position.volume,
        opened_at=opened_at,
        account=account,
        commission=position.commission,
        swap=position.swap,
    )
    if trade.status == TradeStatus.CLOSED.value and position.volume > 0:
        trade.status = TradeStatus.OPEN.value
        trade.result = "open"
        trade.exit_price = None
        trade.exit_timestamp = None
        trade.realized_pnl = None
        trade.realized_r = None
        trade.realized_rr = None
    db.flush()
    return trade


def _deal_already_processed(db: Session, connection_id: UUID, deal_id: str) -> bool:
    return (
        db.query(Mt5ProcessedDeal)
        .filter(
            Mt5ProcessedDeal.connection_id == connection_id,
            Mt5ProcessedDeal.deal_id == deal_id,
        )
        .count()
        > 0
    )


def _close_from_deal(
    db: Session,
    user: User,
    account: Account,
    connection: Mt5Connection,
    deal: Mt5DealIn,
    counters: SyncCounters,
) -> None:
    if _deal_already_processed(db, connection.id, deal.external_deal_id):
        logger.info("MT5 duplicate deal ignored deal_id=%s", deal.external_deal_id)
        return

    trade = _find_mt5_trade(db, account.id, deal.external_position_id)
    if trade is None:
        resolution = resolve_mt5_symbol(deal.symbol_raw)
        direction = Direction.LONG if deal.direction == "LONG" else Direction.SHORT
        opened_at = as_utc(deal.deal_time)
        trade = Trade(
            user_id=user.id,
            account_id=account.id,
            timezone=user.timezone,
            timeframe="M15",
            source=TradeSource.MT5.value,
            external_provider=PROVIDER,
            external_position_id=deal.external_position_id,
            setup_valid=True,
            rules_followed=True,
            emotional_trade=False,
            mistake=False,
            acknowledged_warnings=True,
        )
        db.add(trade)
        _apply_mt5_fields(
            trade,
            symbol=resolution.symbol,
            symbol_raw=resolution.symbol_raw,
            instrument_status=resolution.instrument_status,
            direction=direction,
            entry=deal.price,
            stop_loss=None,
            take_profit=None,
            lot_size=deal.volume,
            opened_at=opened_at,
            account=account,
        )
        counters.created += 1

    if trade.status == TradeStatus.CLOSED.value and trade.external_deal_id == deal.external_deal_id:
        db.add(
            Mt5ProcessedDeal(
                connection_id=connection.id,
                deal_id=deal.external_deal_id,
                trade_id=trade.id,
            )
        )
        return

    broker_pnl = deal.profit + deal.commission + deal.swap
    was_open = trade.status != TradeStatus.CLOSED.value
    _apply_mt5_fields(
        trade,
        symbol=trade.symbol,
        symbol_raw=trade.symbol_raw or deal.symbol_raw,
        instrument_status=InstrumentResolution(trade.instrument_status or InstrumentResolution.UNRESOLVED.value),
        direction=Direction(trade.direction),
        entry=trade.entry_price,
        stop_loss=trade.stop_loss,
        take_profit=trade.take_profit,
        lot_size=deal.volume if deal.volume > 0 else trade.lot_size,
        opened_at=trade.trade_timestamp,
        account=account,
        exit_price=deal.price,
        exit_at=as_utc(deal.deal_time),
        broker_pnl=broker_pnl,
        commission=deal.commission,
        swap=deal.swap,
    )
    trade.external_deal_id = deal.external_deal_id
    if was_open:
        counters.closed += 1
    else:
        counters.updated += 1

    db.add(
        Mt5ProcessedDeal(
            connection_id=connection.id,
            deal_id=deal.external_deal_id,
            trade_id=trade.id,
        )
    )
    db.flush()
    logger.info("MT5 trade closed position_id=%s deal_id=%s", deal.external_position_id, deal.external_deal_id)


def _reconcile_missing_positions(
    db: Session,
    account: Account,
    open_ids: set[str],
    counters: SyncCounters,
) -> None:
    """Open MT5 trades no longer in the position snapshot stay open until a closing deal arrives."""
    if not open_ids:
        return
    stale = (
        db.query(Trade)
        .filter(
            Trade.account_id == account.id,
            Trade.external_provider == PROVIDER,
            Trade.status == TradeStatus.OPEN.value,
            Trade.external_position_id.isnot(None),
            ~Trade.external_position_id.in_(open_ids),
        )
        .all()
    )
    for trade in stale:
        logger.info(
            "MT5 open trade missing from snapshot position_id=%s (awaiting close deal)",
            trade.external_position_id,
        )
