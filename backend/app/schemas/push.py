from __future__ import annotations

from pydantic import BaseModel, Field


class PushKeysIn(BaseModel):
    p256dh: str = Field(min_length=8, max_length=255)
    auth: str = Field(min_length=8, max_length=255)


class PushSubscribeIn(BaseModel):
    endpoint: str = Field(min_length=12, max_length=2048)
    keys: PushKeysIn


class PushConfigOut(BaseModel):
    available: bool
    vapid_public_key: str | None
    reminder_hour: int
    message: str | None = None
