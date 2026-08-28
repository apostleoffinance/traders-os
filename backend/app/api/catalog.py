from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.config import settings
from app.core.security import get_current_user_id, get_db
from app.models.risk_event import RiskEvent
from app.models.setup import Setup
from app.models.trade import TradeScreenshot
from app.schemas.misc import (
    ChecklistReplaceIn,
    ChecklistTemplateCreate,
    ChecklistTemplateOut,
    RiskEventOut,
)
from app.schemas.setup import SetupCreate, SetupOut, SetupUpdate
from app.services import checklist_service
from app.storage.factory import get_storage

setups_router = APIRouter(prefix="/setups", tags=["setups"])
checklists_router = APIRouter(prefix="/checklists", tags=["checklists"])
instruments_router = APIRouter(prefix="/instruments", tags=["catalog"])
events_router = APIRouter(prefix="/risk/events", tags=["risk"])
media_router = APIRouter(prefix="/media", tags=["media"])


def _uses_db_storage() -> bool:
    return settings.storage_backend.lower().strip() == "db"


@setups_router.get("", response_model=list[SetupOut])
def list_setups(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    return db.query(Setup).filter(Setup.user_id == user_id).order_by(Setup.name).all()


@setups_router.post("", response_model=SetupOut, status_code=status.HTTP_201_CREATED)
def create_setup(
    payload: SetupCreate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    setup = Setup(user_id=user_id, **payload.model_dump())
    db.add(setup)
    db.flush()
    checklist_service.create_template(
        db,
        user_id=user_id,
        name=setup.name,
        setup_id=setup.id,
        description=f"Process checks for {setup.name}. Confirmation records review, not edge.",
    )
    db.commit()
    db.refresh(setup)
    return setup


@setups_router.patch("/{setup_id}", response_model=SetupOut)
def update_setup(
    setup_id: UUID,
    payload: SetupUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    setup = db.query(Setup).filter(Setup.id == setup_id, Setup.user_id == user_id).one_or_none()
    if setup is None:
        raise HTTPException(status_code=404, detail="Setup not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(setup, k, v)
    db.commit()
    db.refresh(setup)
    return setup


@instruments_router.get("")
def list_instruments(user_id=Depends(get_current_user_id)):
    return checklist_service.instruments_payload()


@checklists_router.get("/library")
def checklist_library(user_id=Depends(get_current_user_id)):
    return checklist_service.library_payload()


@checklists_router.get("/default", response_model=ChecklistTemplateOut)
def get_default_checklist(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    tmpl = checklist_service.resolve_template(db, user_id, create_missing=True)
    if tmpl is None:
        raise HTTPException(status_code=404, detail="Checklist not found")
    db.commit()
    return tmpl


@checklists_router.put("/default", response_model=ChecklistTemplateOut)
def replace_default_checklist(
    payload: ChecklistReplaceIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    tmpl = checklist_service.resolve_template(db, user_id, create_missing=True)
    if tmpl is None:
        raise HTTPException(status_code=404, detail="Checklist not found")
    if payload.name:
        tmpl.name = payload.name
    if payload.description is not None:
        tmpl.description = payload.description
    checklist_service.replace_items(db, tmpl, payload.items)
    db.commit()
    return checklist_service.get_owned_template(db, user_id, tmpl.id)


@checklists_router.get("", response_model=ChecklistTemplateOut)
def resolve_checklist(
    setup_id: UUID | None = None,
    instrument: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    tmpl = checklist_service.resolve_template(
        db,
        user_id,
        setup_id=setup_id,
        instrument=instrument,
        create_missing=True,
    )
    if tmpl is None:
        raise HTTPException(status_code=404, detail="Checklist not found")
    db.commit()
    return tmpl


@checklists_router.get("/templates", response_model=list[ChecklistTemplateOut])
def list_checklist_templates(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    return checklist_service.list_templates(db, user_id)


@checklists_router.post("/templates", response_model=ChecklistTemplateOut, status_code=status.HTTP_201_CREATED)
def create_checklist_template(
    payload: ChecklistTemplateCreate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    if payload.setup_id:
        setup = db.query(Setup).filter(Setup.id == payload.setup_id, Setup.user_id == user_id).one_or_none()
        if setup is None:
            raise HTTPException(status_code=404, detail="Setup not found")
    existing = checklist_service.resolve_template(
        db,
        user_id,
        setup_id=payload.setup_id,
        instrument=payload.instrument,
        create_missing=False,
    )
    if existing is not None and payload.setup_id and existing.setup_id == payload.setup_id:
        if (existing.instrument or None) == (payload.instrument or None):
            raise HTTPException(status_code=409, detail="A checklist already exists for this setup")
    specs = None
    if payload.items is not None:
        specs = [item.model_dump() for item in payload.items]
    tmpl = checklist_service.create_template(
        db,
        user_id=user_id,
        name=payload.name,
        setup_id=payload.setup_id,
        instrument=(payload.instrument or "").upper().replace("/", "") or None,
        description=payload.description,
        specs=specs,
    )
    db.commit()
    return checklist_service.get_owned_template(db, user_id, tmpl.id)


@checklists_router.get("/templates/{template_id}", response_model=ChecklistTemplateOut)
def get_checklist_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return checklist_service.get_owned_template(db, user_id, template_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@checklists_router.put("/templates/{template_id}", response_model=ChecklistTemplateOut)
def replace_checklist_template(
    template_id: UUID,
    payload: ChecklistReplaceIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        tmpl = checklist_service.get_owned_template(db, user_id, template_id)
    except DomainError as exc:
        raise http_error(exc) from exc
    if payload.name:
        tmpl.name = payload.name
    if payload.description is not None:
        tmpl.description = payload.description
    if payload.instrument is not None:
        tmpl.instrument = payload.instrument.upper().replace("/", "") or None
    if payload.active is not None:
        tmpl.active = payload.active
    checklist_service.replace_items(db, tmpl, payload.items)
    db.commit()
    return checklist_service.get_owned_template(db, user_id, tmpl.id)


@events_router.get("", response_model=list[RiskEventOut])
def list_events(
    account_id: UUID,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return (
        db.query(RiskEvent)
        .filter(RiskEvent.user_id == user_id, RiskEvent.account_id == account_id)
        .order_by(RiskEvent.created_at.desc())
        .limit(200)
        .all()
    )


@media_router.get("/{key:path}")
def get_media(key: str, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    shot = (
        db.query(TradeScreenshot)
        .filter(TradeScreenshot.storage_key == key, TradeScreenshot.user_id == user_id)
        .one_or_none()
    )
    if shot is None:
        raise HTTPException(status_code=404, detail="Not found")
    # Prefer Postgres bytes (STORAGE_BACKEND=db) — survives Render redeploys.
    if shot.file_data:
        return Response(content=bytes(shot.file_data), media_type=shot.content_type or "application/octet-stream")
    if _uses_db_storage():
        # Orphan metadata from pre-db uploads or failed writes — do not call object storage.
        db.delete(shot)
        db.commit()
        raise HTTPException(
            status_code=404,
            detail="Image file is missing. Re-upload from Edit trade.",
        )
    try:
        data = get_storage().get(key)
    except Exception as exc:
        # Missing disk/S3 object.
        db.delete(shot)
        db.commit()
        raise HTTPException(
            status_code=404,
            detail="Image file is missing. Re-upload from Edit trade.",
        ) from exc
    return Response(content=data, media_type=shot.content_type or "application/octet-stream")
