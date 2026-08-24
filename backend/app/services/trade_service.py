from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, joinedload

from app.core.enums import (
    ChecklistItemKind,
    Direction,
    EnforcementMode,
    RiskEventType,
    RiskStatus,
    ScreenshotType,
    TradeStatus,
)
from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.core.time import as_utc, utcnow
from app.engines.account_rules_engine import evaluate_submission, raise_if_blocked
from app.engines.discipline_engine import TradeDisciplineInput, score_trade
from app.engines.fx_math import (
    classify_result,
    holding_seconds,
    planned_metrics,
    realized_pnl,
    realized_r,
    validate_side_prices,
)
from app.engines.process_checks import auto_check_to_dict, evaluate_auto_checks, process_status
from app.engines.risk_engine import RiskEventDraft, compute_risk_snapshot
from app.engines.session_engine import classify_session, in_preferred_window
from app.models.account import Account
from app.models.checklist import TradeChecklistResponse
from app.models.risk_event import RiskEvent
from app.models.setup import Setup
from app.models.trade import Psychology, Trade, TradeScreenshot
from app.models.user import User
from app.schemas.trade import TradeClose, TradeCreate, TradePreviewIn, TradeUpdate
from app.services.access import get_owned_account, get_owned_trade
from app.services.account_service import refresh_account_balances
from app.services.checklist_service import resolve_template
from app.services.mapping import parse_windows, profile_view, trade_to_closed
from app.storage.factory import get_storage


def _load_account_trades(db: Session, account_id: UUID, user_id: UUID) -> list[Trade]:
    return (
        db.query(Trade)
        .options(joinedload(Trade.psychology))
        .filter(Trade.account_id == account_id, Trade.user_id == user_id)
        .all()
    )


def preview(db: Session, user: User, payload: TradePreviewIn) -> dict:
    account = get_owned_account(db, user.id, payload.account_id)
    metrics = planned_metrics(
        symbol=payload.symbol,
        direction=payload.direction,
        entry=payload.entry_price,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        lot_size=payload.lot_size,
        account_balance=Decimal(account.current_equity or account.starting_balance),
        quote_to_account_rate=payload.quote_to_account_rate,
    )
    notes = validate_side_prices(
        payload.direction, payload.entry_price, payload.stop_loss, payload.take_profit
    )
    ts = as_utc(payload.trade_timestamp) if payload.trade_timestamp else utcnow()
    session = classify_session(ts)
    profile = profile_view(account.risk_profile) if account.risk_profile else None
    windows = parse_windows(account.risk_profile.preferred_windows if account.risk_profile else None)
    preferred = in_preferred_window(ts, windows)
    warnings: list[str] = list(notes)

    auto_checks: list[dict] = []
    policy = None
    status = "valid"
    trades_today = 0
    max_trades = None
    if profile is not None and account.risk_profile is not None:
        existing = _load_account_trades(db, account.id, user.id)
        snapshot = compute_risk_snapshot(
            starting_balance=Decimal(account.starting_balance),
            profile=profile,
            trades=[trade_to_closed(t) for t in existing],
            now=ts,
            timezone=user.timezone,
        )
        decision = evaluate_submission(
            planned_risk=metrics["risk_amount"],
            planned_rr=metrics["planned_rr"],
            profile=profile,
            snapshot=snapshot,
            enforcement=EnforcementMode(account.risk_profile.risk_per_trade_enforcement),
            acknowledged=False,
            hard_enforcement=EnforcementMode(account.risk_profile.hard_risk_enforcement),
        )
        hard_blocked = any(w.event_type.value == "risk_per_trade_hard_block" for w in decision.warnings)
        checks = evaluate_auto_checks(
            planned_risk=metrics["risk_amount"],
            planned_rr=metrics["planned_rr"],
            stop_loss_set=payload.stop_loss is not None,
            take_profit_set=payload.take_profit is not None,
            session=session.value,
            in_preferred_session=preferred,
            profile=profile,
            snapshot=snapshot,
            hard_blocked=hard_blocked,
        )
        auto_checks = [auto_check_to_dict(c) for c in checks]
        status = process_status(decision, checks)
        policy = {
            "allowed": decision.allowed,
            "requires_confirmation": decision.requires_confirmation,
            "block_reason": decision.block_reason,
        }
        trades_today = snapshot.trades_today
        max_trades = profile.max_trades_per_day
        warnings.extend(w.message for w in decision.warnings)

    estimated_pnl = None
    estimated_r = None
    estimated_result = None
    if payload.exit_price is not None:
        estimated_pnl = realized_pnl(
            symbol=payload.symbol,
            direction=payload.direction,
            entry=payload.entry_price,
            exit_price=payload.exit_price,
            lot_size=payload.lot_size,
            quote_to_account_rate=payload.quote_to_account_rate,
        )
        estimated_r = realized_r(estimated_pnl, metrics["risk_amount"])
        estimated_result = classify_result(TradeStatus.CLOSED, estimated_pnl).value

    return {
        "symbol": payload.symbol.upper().replace("/", ""),
        "stop_pips": metrics["stop_pips"],
        "tp_pips": metrics["tp_pips"],
        "risk_amount": metrics["risk_amount"],
        "risk_percent": metrics["risk_percent"],
        "planned_reward": metrics["planned_reward"],
        "planned_rr": metrics["planned_rr"],
        "estimated_pnl_at_tp": metrics["planned_reward"],
        "estimated_realized_pnl": estimated_pnl,
        "estimated_realized_r": estimated_r,
        "estimated_result": estimated_result,
        "validation_notes": notes,
        "warnings": warnings,
        "session": session.value,
        "in_preferred_session": preferred,
        "process_status": status,
        "policy": policy,
        "auto_checks": auto_checks,
        "trades_today": trades_today,
        "max_trades_per_day": max_trades,
    }


def _compute_fields(payload: TradeCreate | TradeUpdate, trade: Trade | None, account: Account) -> dict:
    fields_set = payload.model_fields_set if hasattr(payload, "model_fields_set") else set()

    if isinstance(payload, TradeUpdate) and trade is not None:
        symbol = payload.symbol if payload.symbol else trade.symbol
        direction = payload.direction if payload.direction is not None else Direction(trade.direction)
        entry = payload.entry_price if payload.entry_price is not None else trade.entry_price
        sl = payload.stop_loss if payload.stop_loss is not None else trade.stop_loss
        tp = payload.take_profit if "take_profit" in fields_set else trade.take_profit
        lots = payload.lot_size if payload.lot_size is not None else trade.lot_size
        exit_price = payload.exit_price if payload.exit_price is not None else trade.exit_price
        rate = payload.quote_to_account_rate if payload.quote_to_account_rate is not None else Decimal("1")
    else:
        symbol = payload.symbol
        direction = payload.direction
        entry = payload.entry_price
        sl = payload.stop_loss
        tp = payload.take_profit
        lots = payload.lot_size
        exit_price = payload.exit_price
        rate = getattr(payload, "quote_to_account_rate", Decimal("1")) or Decimal("1")

    symbol = str(symbol).upper().replace("/", "")
    direction = direction if isinstance(direction, Direction) else Direction(direction)
    entry = Decimal(entry)
    sl = Decimal(sl)
    lots = Decimal(lots)
    tp_dec = Decimal(tp) if tp is not None else None
    exit_dec = Decimal(exit_price) if exit_price is not None else None

    metrics = planned_metrics(
        symbol=symbol,
        direction=direction,
        entry=entry,
        stop_loss=sl,
        take_profit=tp_dec,
        lot_size=lots,
        account_balance=Decimal(account.current_equity or account.starting_balance),
        quote_to_account_rate=rate,
    )
    status = TradeStatus.CLOSED if exit_dec is not None else TradeStatus.OPEN
    pnl = None
    r_mult = None
    if exit_dec is not None:
        pnl = realized_pnl(
            symbol=symbol,
            direction=direction,
            entry=entry,
            exit_price=exit_dec,
            lot_size=lots,
            quote_to_account_rate=rate,
        )
        r_mult = realized_r(pnl, metrics["risk_amount"])
    result = classify_result(status, pnl)
    return {
        "symbol": symbol,
        "metrics": metrics,
        "status": status,
        "pnl": pnl,
        "r": r_mult,
        "result": result,
        "direction": direction,
        "entry": entry,
        "sl": sl,
        "tp": tp_dec,
        "lots": lots,
        "exit_price": exit_dec,
    }


def create_trade(db: Session, user: User, payload: TradeCreate) -> Trade:
    account = get_owned_account(db, user.id, payload.account_id)
    if account.risk_profile is None:
        raise DomainError("Account has no risk profile configured")

    computed = _compute_fields(payload, None, account)
    tz = payload.timezone or user.timezone
    ts = as_utc(payload.trade_timestamp)
    exit_ts = as_utc(payload.exit_timestamp) if payload.exit_timestamp else None
    session = classify_session(ts)
    windows = parse_windows(account.risk_profile.preferred_windows)
    preferred = in_preferred_window(ts, windows)

    existing = _load_account_trades(db, account.id, user.id)
    snapshot = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile_view(account.risk_profile),
        trades=[trade_to_closed(t) for t in existing],
        now=ts,
        timezone=user.timezone,
    )
    decision = evaluate_submission(
        planned_risk=computed["metrics"]["risk_amount"],
        planned_rr=computed["metrics"]["planned_rr"],
        profile=profile_view(account.risk_profile),
        snapshot=snapshot,
        enforcement=EnforcementMode(account.risk_profile.risk_per_trade_enforcement),
        acknowledged=payload.acknowledged_warnings,
        hard_enforcement=EnforcementMode(account.risk_profile.hard_risk_enforcement),
    )
    raise_if_blocked(decision)

    if payload.setup_id:
        setup = (
            db.query(Setup)
            .filter(Setup.id == payload.setup_id, Setup.user_id == user.id)
            .one_or_none()
        )
        if setup is None:
            raise NotFoundError("Setup not found")

    hard_blocked = any(w.event_type.value == "risk_per_trade_hard_block" for w in decision.warnings)
    auto_checks = evaluate_auto_checks(
        planned_risk=computed["metrics"]["risk_amount"],
        planned_rr=computed["metrics"]["planned_rr"],
        stop_loss_set=computed["sl"] is not None,
        take_profit_set=computed["tp"] is not None,
        session=session.value,
        in_preferred_session=preferred,
        profile=profile_view(account.risk_profile),
        snapshot=snapshot,
        hard_blocked=hard_blocked,
    )
    auto_by_key = {c.auto_key: c.passed for c in auto_checks}
    template = resolve_template(
        db,
        user.id,
        setup_id=payload.setup_id,
        instrument=computed["symbol"],
        create_missing=False,
    )
    ticks = {c.item_id: c.checked for c in payload.checklist}
    checklist_rows: list[tuple] = []
    incomplete_required = False
    if template is not None:
        for item in template.items:
            if item.kind == ChecklistItemKind.AUTOMATIC.value and item.auto_key:
                checked = bool(auto_by_key.get(item.auto_key, False))
            else:
                checked = bool(ticks.get(item.id, False))
                if item.required and not checked:
                    incomplete_required = True
            checklist_rows.append((item.id, checked))

    trades_today = snapshot.trades_today + 1
    checked_n = sum(1 for _, checked in checklist_rows if checked)
    total_items = len(checklist_rows)
    disc = score_trade(
        TradeDisciplineInput(
            planned_risk=computed["metrics"]["risk_amount"],
            risk_limit=Decimal(account.risk_profile.risk_per_trade),
            setup_valid=payload.setup_valid,
            rules_followed=payload.rules_followed,
            stop_loss_set=True,
            take_profit_set=computed["tp"] is not None,
            planned_rr=computed["metrics"]["planned_rr"],
            preferred_min_rr=Decimal(account.risk_profile.preferred_min_rr),
            session=session,
            in_preferred_session=preferred,
            checklist_checked=checked_n,
            checklist_total=total_items,
            emotional_trade=payload.emotional_trade,
            revenge=bool(payload.psychology and (payload.psychology.revenge >= 5 or payload.psychology.emotion_before.value == "revenge")),
            mistake=payload.mistake,
            trades_today_including_this=trades_today,
            max_trades_per_day=account.risk_profile.max_trades_per_day,
        )
    )

    trade = Trade(
        user_id=user.id,
        account_id=account.id,
        symbol=computed["symbol"],
        direction=computed["direction"].value,
        trade_timestamp=ts,
        exit_timestamp=exit_ts,
        timezone=tz,
        session=session.value,
        in_preferred_session=preferred,
        setup_id=payload.setup_id,
        timeframe=payload.timeframe.value,
        entry_price=computed["entry"],
        exit_price=computed["exit_price"],
        stop_loss=computed["sl"],
        take_profit=computed["tp"],
        lot_size=computed["lots"],
        stop_pips=computed["metrics"]["stop_pips"],
        tp_pips=computed["metrics"]["tp_pips"],
        risk_amount=computed["metrics"]["risk_amount"],
        risk_percent=computed["metrics"]["risk_percent"],
        planned_reward=computed["metrics"]["planned_reward"],
        planned_rr=computed["metrics"]["planned_rr"],
        realized_pnl=computed["pnl"],
        realized_r=computed["r"],
        realized_rr=computed["r"],
        result=computed["result"].value,
        status=computed["status"].value,
        holding_time_seconds=holding_seconds(ts, exit_ts),
        setup_valid=payload.setup_valid,
        rules_followed=payload.rules_followed,
        emotional_trade=payload.emotional_trade,
        mistake=payload.mistake,
        mistake_notes=payload.mistake_notes,
        notes=payload.notes,
        discipline_score=disc.total,
        acknowledged_warnings=payload.acknowledged_warnings,
        source=payload.source,
        source_analysis_id=payload.source_analysis_id,
    )
    db.add(trade)
    db.flush()

    if payload.psychology:
        pdata = payload.psychology.model_dump()
        for key in ("emotion_before", "emotion_during", "emotion_after"):
            val = pdata[key]
            pdata[key] = val.value if hasattr(val, "value") else val
        db.add(Psychology(user_id=user.id, trade_id=trade.id, **pdata))

    for item_id, checked in checklist_rows:
        db.add(TradeChecklistResponse(trade_id=trade.id, item_id=item_id, checked=checked))

    if incomplete_required:
        decision.warnings.append(
            RiskEventDraft(
                event_type=RiskEventType.CHECKLIST_INCOMPLETE,
                severity=RiskStatus.YELLOW,
                message="INCOMPLETE — one or more required process checks were not confirmed.",
            )
        )

    for warning in decision.warnings:
        db.add(
            RiskEvent(
                user_id=user.id,
                account_id=account.id,
                trade_id=trade.id,
                event_type=warning.event_type.value,
                severity=warning.severity.value,
                message=warning.message,
                metric_value=warning.metric_value,
                threshold_value=warning.threshold_value,
            )
        )

    refresh_account_balances(db, account)
    db.commit()
    return get_trade(db, user.id, trade.id)


def get_trade(db: Session, user_id: UUID, trade_id: UUID) -> Trade:
    trade = (
        db.query(Trade)
        .options(
            joinedload(Trade.psychology),
            joinedload(Trade.screenshots),
            joinedload(Trade.checklist_responses).joinedload(TradeChecklistResponse.item),
            joinedload(Trade.setup),
        )
        .filter(Trade.id == trade_id, Trade.user_id == user_id)
        .one_or_none()
    )
    if trade is None:
        raise NotFoundError("Trade not found")
    return trade


def list_trades(
    db: Session,
    user_id: UUID,
    *,
    account_id: UUID | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    result: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Trade]:
    q = (
        db.query(Trade)
        .options(joinedload(Trade.psychology), joinedload(Trade.setup), joinedload(Trade.screenshots))
        .filter(Trade.user_id == user_id)
    )
    if account_id:
        q = q.filter(Trade.account_id == account_id)
    if session:
        q = q.filter(Trade.session == session)
    if setup_id:
        q = q.filter(Trade.setup_id == setup_id)
    if direction:
        q = q.filter(Trade.direction == direction)
    if result:
        q = q.filter(Trade.result == result)
    if status:
        q = q.filter(Trade.status == status)
    if date_from:
        q = q.filter(Trade.trade_timestamp >= as_utc(date_from))
    if date_to:
        q = q.filter(Trade.trade_timestamp <= as_utc(date_to))
    return q.order_by(Trade.trade_timestamp.desc()).all()


def _apply_psychology(db: Session, user: User, trade: Trade, psychology) -> None:
    if psychology is None:
        return
    if trade.psychology is None:
        psy = Psychology(user_id=user.id, trade_id=trade.id)
        db.add(psy)
        trade.psychology = psy
    for k, v in psychology.model_dump().items():
        setattr(trade.psychology, k, v.value if hasattr(v, "value") else v)


def _apply_computed(trade: Trade, computed: dict, exit_ts: datetime | None = None) -> None:
    trade.symbol = computed["symbol"]
    trade.direction = computed["direction"].value
    trade.entry_price = computed["entry"]
    trade.stop_loss = computed["sl"]
    trade.take_profit = computed["tp"]
    trade.lot_size = computed["lots"]
    trade.exit_price = computed["exit_price"]
    trade.stop_pips = computed["metrics"]["stop_pips"]
    trade.tp_pips = computed["metrics"]["tp_pips"]
    trade.risk_amount = computed["metrics"]["risk_amount"]
    trade.risk_percent = computed["metrics"]["risk_percent"]
    trade.planned_reward = computed["metrics"]["planned_reward"]
    trade.planned_rr = computed["metrics"]["planned_rr"]
    trade.realized_pnl = computed["pnl"]
    trade.realized_r = computed["r"]
    trade.realized_rr = computed["r"]
    trade.result = computed["result"].value
    trade.status = computed["status"].value
    if exit_ts is not None or computed["exit_price"] is not None:
        if exit_ts is not None:
            trade.exit_timestamp = as_utc(exit_ts)
        elif trade.exit_timestamp is None and computed["exit_price"] is not None:
            trade.exit_timestamp = utcnow()
    trade.holding_time_seconds = holding_seconds(
        as_utc(trade.trade_timestamp) if trade.trade_timestamp else None,
        as_utc(trade.exit_timestamp) if trade.exit_timestamp else None,
    )


def update_trade(db: Session, user: User, trade_id: UUID, payload: TradeUpdate) -> Trade:
    trade = get_trade(db, user.id, trade_id)
    account = get_owned_account(db, user.id, trade.account_id)
    computed = _compute_fields(payload, trade, account)

    data = payload.model_dump(exclude_unset=True, exclude={"psychology", "checklist", "quote_to_account_rate"})
    for key, value in data.items():
        if key in {
            "symbol",
            "direction",
            "entry_price",
            "stop_loss",
            "take_profit",
            "lot_size",
            "exit_price",
            "exit_timestamp",
        }:
            continue
        if key == "timeframe" and value is not None:
            setattr(trade, key, value.value if hasattr(value, "value") else value)
        elif key == "trade_timestamp" and value is not None:
            trade.trade_timestamp = as_utc(value)
            trade.session = classify_session(trade.trade_timestamp).value
            windows = parse_windows(account.risk_profile.preferred_windows) if account.risk_profile else []
            trade.in_preferred_session = in_preferred_window(trade.trade_timestamp, windows)
        else:
            setattr(trade, key, value)

    exit_ts = None
    if "exit_timestamp" in payload.model_fields_set:
        exit_ts = as_utc(payload.exit_timestamp) if payload.exit_timestamp else None
        trade.exit_timestamp = exit_ts

    _apply_computed(trade, computed, exit_ts=trade.exit_timestamp)
    _apply_psychology(db, user, trade, payload.psychology)

    if payload.checklist is not None:
        db.query(TradeChecklistResponse).filter(TradeChecklistResponse.trade_id == trade.id).delete()
        for item in payload.checklist:
            db.add(TradeChecklistResponse(trade_id=trade.id, item_id=item.item_id, checked=item.checked))

    refresh_account_balances(db, account)
    db.commit()
    return get_trade(db, user.id, trade.id)


def close_trade(db: Session, user: User, trade_id: UUID, payload: TradeClose) -> Trade:
    trade = get_trade(db, user.id, trade_id)
    if trade.status == TradeStatus.CLOSED.value:
        raise ConflictError("Trade is already closed.")

    data: dict = {
        "exit_price": payload.exit_price,
        "exit_timestamp": payload.exit_timestamp or utcnow(),
    }
    if payload.notes is not None:
        data["notes"] = payload.notes
    if payload.setup_valid is not None:
        data["setup_valid"] = payload.setup_valid
    if payload.rules_followed is not None:
        data["rules_followed"] = payload.rules_followed
    if payload.emotional_trade is not None:
        data["emotional_trade"] = payload.emotional_trade
    if payload.mistake is not None:
        data["mistake"] = payload.mistake
    if payload.mistake_notes is not None:
        data["mistake_notes"] = payload.mistake_notes
    if payload.psychology is not None:
        data["psychology"] = payload.psychology
    return update_trade(db, user, trade_id, TradeUpdate(**data))


def delete_trade(db: Session, user: User, trade_id: UUID) -> None:
    trade = get_owned_trade(db, user.id, trade_id)
    account = get_owned_account(db, user.id, trade.account_id)
    storage = get_storage()
    for shot in list(trade.screenshots):
        try:
            storage.delete(shot.storage_key)
        except Exception:
            pass
    db.delete(trade)
    db.flush()
    refresh_account_balances(db, account)
    db.commit()


ALLOWED_CONTENT = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def add_screenshot(
    db: Session,
    user: User,
    trade_id: UUID,
    file_bytes: bytes,
    content_type: str,
    filename: str,
    shot_type: ScreenshotType,
) -> TradeScreenshot:
    if content_type not in ALLOWED_CONTENT:
        raise DomainError("Unsupported image type. Use PNG, JPEG, WebP or GIF.")
    trade = get_owned_trade(db, user.id, trade_id)
    key = f"{user.id}/{trade.id}/{shot_type.value}-{uuid4().hex}"
    get_storage().put(key, file_bytes, content_type)
    shot = TradeScreenshot(
        user_id=user.id,
        trade_id=trade.id,
        type=shot_type.value,
        storage_key=key,
        original_filename=filename,
        content_type=content_type,
    )
    db.add(shot)
    db.commit()
    db.refresh(shot)
    return shot


def delete_screenshot(db: Session, user: User, trade_id: UUID, screenshot_id: UUID) -> None:
    trade = get_owned_trade(db, user.id, trade_id)
    shot = next((s for s in trade.screenshots if s.id == screenshot_id), None)
    if shot is None:
        raise NotFoundError("Screenshot not found")
    get_storage().delete(shot.storage_key)
    db.delete(shot)
    db.commit()
