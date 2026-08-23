from __future__ import annotations

from app.core.config import settings

PROMPT_VERSION = settings.ai_prompt_version


def provider_order() -> list[str]:
    return [p.strip().lower() for p in settings.ai_provider_order.split(",") if p.strip()]
