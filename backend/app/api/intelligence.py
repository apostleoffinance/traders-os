from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.services import auth_service, intelligence_service

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _user(db, user_id):
    return auth_service.get_user(db, user_id)


@router.get("/feed")
def get_intelligence_feed(
    account_id: UUID = Query(...),
    preset: str = Query("30d"),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return intelligence_service.intelligence_feed(
            db, _user(db, user_id), account_id, preset=preset
        )
    except DomainError as exc:
        raise http_error(exc) from exc
