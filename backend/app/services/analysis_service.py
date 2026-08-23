from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from app.core.enums import AnalysisStatus, Direction, Timeframe
from app.core.exceptions import ConversionUnavailable, DomainError, NotFoundError
from app.core.time import as_utc, utcnow
from app.engines.fx_math import normalize_symbol, planned_metrics, position_size_from_risk
from app.engines.session_engine import classify_session
from app.market_data.service import conversion_rate
from app.models.market import ChartAnnotation, MarketAnalysis
from app.models.setup import Setup
from app.schemas.market import AnalysisIn, AnalysisUpdate, AnnotationIn, SizeIn, TradePlanIn
from app.schemas.trade import TradeCreate, TradePreviewIn
from app.services.access import get_owned_account
from app.services import trade_service
from app.models.user import User


def _owned_analysis(db: Session, user_id: UUID, analysis_id: UUID) -> MarketAnalysis:
    row = (
        db.query(MarketAnalysis)
        .options(selectinload(MarketAnalysis.annotations))
        .filter(MarketAnalysis.id == analysis_id, MarketAnalysis.user_id == user_id)
        .one_or_none()
    )
    if row is None:
        raise NotFoundError("Analysis not found")
    return row


def _rr(entry: Decimal | None, sl: Decimal | None, tp: Decimal | None, symbol: str, lots: Decimal, rate: Decimal) -> Decimal | None:
    if entry is None or sl is None:
        return None
    metrics = planned_metrics(
        symbol=symbol,
        direction=Direction.LONG,
        entry=entry,
        stop_loss=sl,
        take_profit=tp,
        lot_size=lots,
        account_balance=Decimal("1"),
        quote_to_account_rate=rate,
    )
    return metrics["planned_rr"]


def size_trade(db: Session, user: User, payload: SizeIn) -> dict:
    account = get_owned_account(db, user.id, payload.account_id)
    conv = conversion_rate(db, payload.symbol, account.currency)
    if conv["rate"] is None:
        raise ConversionUnavailable(conv["reason"] or "Conversion rate unavailable.")
    rate = Decimal(str(conv["rate"]))
    balance = Decimal(account.current_equity or account.starting_balance)
    if payload.lot_size is not None:
        metrics = planned_metrics(
            symbol=payload.symbol,
            direction=payload.direction,
            entry=payload.entry,
            stop_loss=payload.stop_loss,
            take_profit=payload.take_profit,
            lot_size=payload.lot_size,
            account_balance=balance,
            quote_to_account_rate=rate,
        )
        return {
            "lot_size": payload.lot_size,
            "conversion": conv,
            **metrics,
        }
    risk = payload.risk_amount
    if risk is None:
        if account.risk_profile is None:
            raise DomainError("Account has no risk profile configured")
        risk = Decimal(account.risk_profile.risk_per_trade)
    sized = position_size_from_risk(
        symbol=payload.symbol,
        entry=payload.entry,
        stop_loss=payload.stop_loss,
        risk_amount=risk,
        account_balance=balance,
        quote_to_account_rate=rate,
        take_profit=payload.take_profit,
        direction=payload.direction,
    )
    return {"conversion": conv, **sized}


def create_analysis(db: Session, user: User, payload: AnalysisIn) -> MarketAnalysis:
    account = get_owned_account(db, user.id, payload.account_id)
    ts = as_utc(payload.analysis_timestamp) if payload.analysis_timestamp else utcnow()
    symbol = normalize_symbol(payload.symbol)
    rate = None
    rr = None
    try:
        conv = conversion_rate(db, symbol, account.currency)
        rate = Decimal(str(conv["rate"])) if conv["rate"] is not None else None
    except Exception:
        rate = None
    lots = payload.position_size or Decimal("0.01")
    if rate is not None:
        rr = _rr(payload.entry, payload.stop_loss, payload.take_profit, symbol, lots, rate)
    if payload.setup_id:
        setup = db.query(Setup).filter(Setup.id == payload.setup_id, Setup.user_id == user.id).one_or_none()
        if setup is None:
            raise NotFoundError("Setup not found")
    row = MarketAnalysis(
        user_id=user.id,
        account_id=account.id,
        symbol=symbol,
        timeframe=payload.timeframe,
        session=classify_session(ts).value,
        setup_id=payload.setup_id,
        direction=payload.direction.value if payload.direction else None,
        analysis_timestamp=ts,
        entry=payload.entry,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        planned_risk=payload.planned_risk,
        planned_rr=rr,
        position_size=payload.position_size,
        quote_to_account_rate=rate,
        thesis=payload.thesis,
        market_context=payload.market_context,
        liquidity_notes=payload.liquidity_notes,
        structure_notes=payload.structure_notes,
        rejection_notes=payload.rejection_notes,
        psychology_state=payload.psychology_state,
        checklist_state=payload.checklist_state,
        chart_range=payload.chart_range,
        status=payload.status or AnalysisStatus.DRAFT.value,
    )
    db.add(row)
    db.flush()
    for ann in payload.annotations:
        db.add(_annotation(user.id, account.id, row, ann))
    db.commit()
    return _owned_analysis(db, user.id, row.id)


def list_analyses(db: Session, user_id: UUID, account_id: UUID | None = None) -> list[MarketAnalysis]:
    q = (
        db.query(MarketAnalysis)
        .options(selectinload(MarketAnalysis.annotations))
        .filter(MarketAnalysis.user_id == user_id)
    )
    if account_id:
        q = q.filter(MarketAnalysis.account_id == account_id)
    return q.order_by(MarketAnalysis.analysis_timestamp.desc()).limit(100).all()


def update_analysis(db: Session, user: User, analysis_id: UUID, payload: AnalysisUpdate) -> MarketAnalysis:
    row = _owned_analysis(db, user.id, analysis_id)
    data = payload.model_dump(exclude_unset=True)
    annotations_in = data.pop("annotations", None)
    if "direction" in data and data["direction"] is not None:
        data["direction"] = data["direction"].value if hasattr(data["direction"], "value") else data["direction"]
    for k, v in data.items():
        setattr(row, k, v)
    if annotations_in is not None:
        replace_annotations(db, user, row, payload.annotations or [])
    db.commit()
    return _owned_analysis(db, user.id, row.id)


def replace_annotations(
    db: Session, user: User, analysis: MarketAnalysis, items: list[AnnotationIn]
) -> None:
    db.query(ChartAnnotation).filter(
        ChartAnnotation.analysis_id == analysis.id,
        ChartAnnotation.user_id == user.id,
    ).delete(synchronize_session=False)
    for item in items:
        db.add(_annotation(user.id, analysis.account_id, analysis, item))


def add_annotation(db: Session, user: User, analysis_id: UUID, payload: AnnotationIn) -> ChartAnnotation:
    row = _owned_analysis(db, user.id, analysis_id)
    ann = _annotation(user.id, row.account_id, row, payload)
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


def update_annotation(db: Session, user: User, annotation_id: UUID, payload: AnnotationIn) -> ChartAnnotation:
    ann = (
        db.query(ChartAnnotation)
        .filter(ChartAnnotation.id == annotation_id, ChartAnnotation.user_id == user.id)
        .one_or_none()
    )
    if ann is None:
        raise NotFoundError("Annotation not found")
    ann.type = payload.type
    ann.timestamp = as_utc(payload.timestamp)
    ann.timestamp_end = as_utc(payload.timestamp_end) if payload.timestamp_end else None
    ann.price = payload.price
    ann.price_end = payload.price_end
    ann.text = payload.text
    ann.extra = payload.extra
    db.commit()
    db.refresh(ann)
    return ann


def delete_annotation(db: Session, user: User, annotation_id: UUID) -> None:
    ann = (
        db.query(ChartAnnotation)
        .filter(ChartAnnotation.id == annotation_id, ChartAnnotation.user_id == user.id)
        .one_or_none()
    )
    if ann is None:
        raise NotFoundError("Annotation not found")
    db.delete(ann)
    db.commit()


def _annotation(user_id: UUID, account_id: UUID, analysis: MarketAnalysis, payload: AnnotationIn) -> ChartAnnotation:
    return ChartAnnotation(
        user_id=user_id,
        analysis_id=analysis.id,
        account_id=account_id,
        symbol=analysis.symbol,
        timeframe=analysis.timeframe,
        type=payload.type,
        timestamp=as_utc(payload.timestamp),
        timestamp_end=as_utc(payload.timestamp_end) if payload.timestamp_end else None,
        price=payload.price,
        price_end=payload.price_end,
        text=payload.text,
        extra=payload.extra,
    )


def trade_plan(db: Session, user: User, analysis_id: UUID, payload: TradePlanIn) -> dict:
    row = _owned_analysis(db, user.id, analysis_id)
    if row.entry is None or row.stop_loss is None:
        raise DomainError("Analysis needs entry and stop-loss before a trade plan can be created.")
    if row.direction is None:
        raise DomainError("Analysis needs a direction before a trade plan can be created.")
    account = get_owned_account(db, user.id, row.account_id)
    conv = conversion_rate(db, row.symbol, account.currency)
    if conv["rate"] is None:
        raise ConversionUnavailable(conv["reason"] or "Conversion rate unavailable.")
    rate = Decimal(str(conv["rate"]))
    lots = payload.lot_size or row.position_size
    if lots is None:
        risk = row.planned_risk
        if risk is None and account.risk_profile is not None:
            risk = Decimal(account.risk_profile.risk_per_trade)
        if risk is None:
            raise DomainError("Set position size or planned risk first.")
        sized = position_size_from_risk(
            symbol=row.symbol,
            entry=row.entry,
            stop_loss=row.stop_loss,
            risk_amount=risk,
            account_balance=Decimal(account.current_equity or account.starting_balance),
            quote_to_account_rate=rate,
            take_profit=row.take_profit,
            direction=Direction(row.direction),
        )
        lots = sized["lot_size"]
    preview_in = TradePreviewIn(
        account_id=row.account_id,
        symbol=row.symbol,
        direction=Direction(row.direction),
        entry_price=row.entry,
        stop_loss=row.stop_loss,
        take_profit=row.take_profit,
        lot_size=lots,
        quote_to_account_rate=rate,
        trade_timestamp=row.analysis_timestamp,
    )
    preview = trade_service.preview(db, user, preview_in)
    draft = {
        "account_id": str(row.account_id),
        "symbol": row.symbol,
        "direction": row.direction,
        "timeframe": row.timeframe,
        "setup_id": str(row.setup_id) if row.setup_id else None,
        "entry_price": row.entry,
        "stop_loss": row.stop_loss,
        "take_profit": row.take_profit,
        "lot_size": lots,
        "quote_to_account_rate": rate,
        "notes": payload.notes or row.thesis,
        "source": "market_analysis",
        "source_analysis_id": str(row.id),
        "trade_timestamp": row.analysis_timestamp,
    }
    if not payload.create_trade:
        return {"draft": draft, "preview": preview, "conversion": conv, "created_trade": None}

    create = TradeCreate(
        account_id=row.account_id,
        symbol=row.symbol,
        direction=Direction(row.direction),
        trade_timestamp=row.analysis_timestamp,
        timezone=user.timezone,
        setup_id=row.setup_id,
        timeframe=Timeframe(row.timeframe),
        entry_price=row.entry,
        stop_loss=row.stop_loss,
        take_profit=row.take_profit,
        lot_size=lots,
        quote_to_account_rate=rate,
        notes=payload.notes or row.thesis,
        acknowledged_warnings=payload.acknowledged_warnings,
        source="market_analysis",
        source_analysis_id=row.id,
        checklist=payload.checklist,
    )
    trade = trade_service.create_trade(db, user, create)
    row.status = AnalysisStatus.EXECUTED.value
    db.commit()
    from app.services.serializers import serialize_trade

    return {
        "draft": draft,
        "preview": preview,
        "conversion": conv,
        "created_trade": serialize_trade(trade),
    }
