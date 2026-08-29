from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.enums import ScreenshotType
from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.schemas.trade import TradeClose, TradeCreate, TradeOut, TradePreviewIn, TradePreviewOut, TradeUpdate
from app.services import auth_service, trade_service
from app.services.serializers import serialize_trade

router = APIRouter(prefix="/trades", tags=["trades"])


def _user(db, user_id):
    return auth_service.get_user(db, user_id)


@router.post("/preview", response_model=TradePreviewOut)
def preview_trade(
    payload: TradePreviewIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return trade_service.preview(db, _user(db, user_id), payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("", response_model=list[TradeOut])
def list_trades(
    account_id: UUID | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    result: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    trades = trade_service.list_trades(
        db,
        user_id,
        account_id=account_id,
        session=session,
        setup_id=setup_id,
        direction=direction,
        result=result,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    return [serialize_trade(t) for t in trades]


@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
def create_trade(
    payload: TradeCreate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        trade = trade_service.create_trade(db, _user(db, user_id), payload)
        return serialize_trade(trade)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/{trade_id}/replay")
def trade_replay(trade_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return trade_service.get_trade_replay(db, user_id, trade_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/{trade_id}", response_model=TradeOut)
def get_trade(trade_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return serialize_trade(trade_service.get_trade(db, user_id, trade_id))
    except DomainError as exc:
        raise http_error(exc) from exc


@router.put("/{trade_id}", response_model=TradeOut)
def update_trade(
    trade_id: UUID,
    payload: TradeUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return serialize_trade(trade_service.update_trade(db, _user(db, user_id), trade_id, payload))
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/{trade_id}/close", response_model=TradeOut)
def close_trade(
    trade_id: UUID,
    payload: TradeClose,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return serialize_trade(trade_service.close_trade(db, _user(db, user_id), trade_id, payload))
    except DomainError as exc:
        raise http_error(exc) from exc


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trade(trade_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        trade_service.delete_trade(db, _user(db, user_id), trade_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/{trade_id}/screenshots", status_code=status.HTTP_201_CREATED)
async def upload_screenshot(
    trade_id: UUID,
    file: UploadFile = File(...),
    type: ScreenshotType = Form(ScreenshotType.ENTRY),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        data = await file.read()
        shot = trade_service.add_screenshot(
            db,
            _user(db, user_id),
            trade_id,
            data,
            file.content_type or "image/png",
            file.filename or "chart.png",
            type,
        )
        from app.services.serializers import screenshot_url

        return {
            "id": str(shot.id),
            "type": shot.type,
            "storage_key": shot.storage_key,
            "url": screenshot_url(shot.storage_key),
        }
    except DomainError as exc:
        raise http_error(exc) from exc


@router.delete("/{trade_id}/screenshots/{screenshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_screenshot(
    trade_id: UUID,
    screenshot_id: UUID,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        trade_service.delete_screenshot(db, _user(db, user_id), trade_id, screenshot_id)
    except DomainError as exc:
        raise http_error(exc) from exc
