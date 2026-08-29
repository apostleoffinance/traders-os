from __future__ import annotations

from app.models.trade import Trade
from app.schemas.trade import ChecklistResponseOut, PsychologyOut, ScreenshotOut, TradeOut


def screenshot_url(storage_key: str) -> str:
    return f"/api/media/{storage_key}"


def serialize_trade(trade: Trade, extra_warnings: list[str] | None = None) -> TradeOut:
    checklist: list[ChecklistResponseOut] = []
    for resp in trade.checklist_responses:
        label = None
        if resp.item is not None:
            label = resp.item.label
        checklist.append(
            ChecklistResponseOut(
                item_id=resp.item_id,
                checked=resp.checked,
                label=label,
                category=resp.item.category if resp.item is not None else None,
                kind=resp.item.kind if resp.item is not None else None,
                auto_key=resp.item.auto_key if resp.item is not None else None,
                required=resp.item.required if resp.item is not None else None,
            )
        )
    return TradeOut(
        id=trade.id,
        user_id=trade.user_id,
        account_id=trade.account_id,
        symbol=trade.symbol,
        direction=trade.direction,
        trade_timestamp=trade.trade_timestamp,
        exit_timestamp=trade.exit_timestamp,
        timezone=trade.timezone,
        session=trade.session,
        in_preferred_session=trade.in_preferred_session,
        setup_id=trade.setup_id,
        setup_name=trade.setup.name if trade.setup else None,
        timeframe=trade.timeframe,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        stop_loss=trade.stop_loss,
        take_profit=trade.take_profit,
        lot_size=trade.lot_size,
        stop_pips=trade.stop_pips,
        tp_pips=trade.tp_pips,
        risk_amount=trade.risk_amount,
        risk_percent=trade.risk_percent,
        planned_reward=trade.planned_reward,
        planned_rr=trade.planned_rr,
        realized_pnl=trade.realized_pnl,
        realized_r=trade.realized_r,
        realized_rr=trade.realized_rr,
        result=trade.result,
        status=trade.status,
        holding_time_seconds=trade.holding_time_seconds,
        setup_valid=trade.setup_valid,
        rules_followed=trade.rules_followed,
        emotional_trade=trade.emotional_trade,
        mistake=trade.mistake,
        mistake_notes=trade.mistake_notes,
        notes=trade.notes,
        discipline_score=trade.discipline_score,
        acknowledged_warnings=trade.acknowledged_warnings,
        source=getattr(trade, "source", None) or "manual",
        source_analysis_id=getattr(trade, "source_analysis_id", None),
        external_provider=getattr(trade, "external_provider", None),
        external_position_id=getattr(trade, "external_position_id", None),
        symbol_raw=getattr(trade, "symbol_raw", None),
        instrument_status=getattr(trade, "instrument_status", None),
        commission=getattr(trade, "commission", None),
        swap=getattr(trade, "swap", None),
        mfe_price=getattr(trade, "mfe_price", None),
        mae_price=getattr(trade, "mae_price", None),
        mfe_r=getattr(trade, "mfe_r", None),
        mae_r=getattr(trade, "mae_r", None),
        mfe_mae_source=getattr(trade, "mfe_mae_source", None),
        mfe_mae_precision=getattr(trade, "mfe_mae_precision", None),
        created_at=trade.created_at,
        psychology=PsychologyOut.model_validate(trade.psychology) if trade.psychology else None,
        screenshots=[
            ScreenshotOut(
                id=s.id,
                type=s.type,
                storage_key=s.storage_key,
                url=screenshot_url(s.storage_key),
                original_filename=s.original_filename,
                created_at=s.created_at,
            )
            for s in sorted(trade.screenshots, key=lambda s: s.created_at or s.id, reverse=True)
        ],
        checklist=checklist,
        warnings=extra_warnings or [],
    )
