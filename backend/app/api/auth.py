from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import decode_token, get_current_user_id, get_db
from app.schemas.auth import RefreshIn, TokenPair, UserCreate, UserLogin, UserOut, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenPair:
    try:
        return auth_service.register(db, payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/login", response_model=TokenPair)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenPair:
    try:
        return auth_service.login(db, payload.email, payload.password)
    except DomainError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password") from exc


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> TokenPair:
    user_id = decode_token(payload.refresh_token, "refresh")
    user = auth_service.get_user(db, user_id)
    from app.core.security import create_access_token, create_refresh_token

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)) -> UserOut:
    return UserOut.model_validate(auth_service.get_user(db, user_id))


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
) -> UserOut:
    user = auth_service.get_user(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
