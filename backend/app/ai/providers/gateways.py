from __future__ import annotations

from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.core.config import settings


def openrouter_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        name="openrouter",
        api_key=settings.openrouter_api_key,
        model=settings.openrouter_model,
        base_url=settings.openrouter_api_base,
        extra_headers={
            "HTTP-Referer": "https://trader-os.local",
            "X-Title": "Trader OS",
        },
    )


def bazaarlink_provider() -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        name="bazaarlink",
        api_key=settings.bazaarlink_api_key,
        model=settings.bazaarlink_model,
        base_url=settings.bazaarlink_api_base,
    )
