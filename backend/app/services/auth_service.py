from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.setup import Setup
from app.models.user import User
from app.schemas.auth import TokenPair, UserCreate, UserOut
from app.services.checklist_service import provision_user_checklists
from app.services.defaults import DEFAULT_SETUPS


def _provision_defaults(db: Session, user: User) -> None:
    setups: list[Setup] = []
    for item in DEFAULT_SETUPS:
        setup = Setup(user_id=user.id, name=item["name"], description=item["description"])
        db.add(setup)
        setups.append(setup)
    db.flush()
    provision_user_checklists(db, user.id, setups)


def register(db: Session, payload: UserCreate) -> TokenPair:
    existing = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if existing:
        raise ConflictError("An account with this email already exists")
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name or payload.email.split("@")[0],
        timezone=payload.timezone,
    )
    db.add(user)
    db.flush()
    _provision_defaults(db, user)
    db.commit()
    db.refresh(user)
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


def login(db: Session, email: str, password: str) -> TokenPair:
    user = db.query(User).filter(User.email == email.lower()).one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        raise NotFoundError("Invalid email or password")
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


def get_user(db: Session, user_id: UUID) -> User:
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if user is None:
        raise NotFoundError("User not found")
    return user
