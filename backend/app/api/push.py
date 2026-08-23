from __future__ import annotations

import hmac
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.schemas.push import PushConfigOut, PushSubscribeIn
from app.services import auth_service, push_service

router = APIRouter(prefix="/push", tags=["reminders"])


@router.get("/config", response_model=PushConfigOut)
def push_config() -> PushConfigOut:
    return PushConfigOut.model_validate(push_service.config_payload())


@router.post("/subscribe")
def subscribe(
    payload: PushSubscribeIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
) -> Response:
    try:
        user = auth_service.get_user(db, user_id)
        push_service.subscribe(
            db,
            user,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
        )
    except DomainError as exc:
        raise http_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/subscribe")
def unsubscribe(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)) -> Response:
    user = auth_service.get_user(db, user_id)
    push_service.disable(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dispatch")
def dispatch(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
) -> dict:
    secret = settings.cron_secret
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cron is not configured.")
    presented = ""
    if authorization and authorization.lower().startswith("bearer "):
        presented = authorization[7:].strip()
    elif x_cron_secret:
        presented = x_cron_secret.strip()
    try:
        ok = bool(presented) and hmac.compare_digest(presented, secret)
    except ValueError:
        ok = False
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret.")
    return push_service.dispatch_due(db)
