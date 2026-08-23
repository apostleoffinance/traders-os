from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import ORMModel


class SetupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    active: bool = True


class SetupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    active: bool | None = None


class SetupOut(ORMModel):
    id: UUID
    user_id: UUID
    name: str
    description: str | None
    active: bool
    created_at: datetime
