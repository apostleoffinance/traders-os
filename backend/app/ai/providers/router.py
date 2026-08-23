"""Try providers in configured order. Skip unconfigured. Fail over on ProviderError."""

from __future__ import annotations

from app.ai.config import provider_order
from app.ai.providers.base import AIProvider, ProviderError
from app.ai.providers.gateways import bazaarlink_provider, openrouter_provider
from app.ai.providers.gemini import GeminiProvider
from app.core.exceptions import AIUnavailable


def default_providers() -> list[AIProvider]:
    mapping: dict[str, AIProvider] = {
        "gemini": GeminiProvider(),
        "openrouter": openrouter_provider(),
        "bazaarlink": bazaarlink_provider(),
    }
    ordered: list[AIProvider] = []
    for name in provider_order():
        provider = mapping.get(name)
        if provider is not None:
            ordered.append(provider)
    return ordered


class FailoverRouter:
    def __init__(self, providers: list[AIProvider] | None = None) -> None:
        self.providers = providers if providers is not None else default_providers()

    def available_names(self) -> list[str]:
        return [p.name for p in self.providers if p.available()]

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str, str]:
        """Return (raw_json, provider_name, model_id)."""
        errors: list[str] = []
        tried = False
        for provider in self.providers:
            if not provider.available():
                continue
            tried = True
            try:
                text, model = provider.complete_json(system=system, user=user, schema_name=schema_name)
                return text, provider.name, model
            except ProviderError as exc:
                errors.append(str(exc))
        if not tried:
            raise AIUnavailable(
                "No AI provider is configured. Set GEMINI_API_KEY, OPENROUTER_API_KEY, or BAZAARLINK_API_KEY."
            )
        raise AIUnavailable("AI analysis temporarily unavailable. " + " | ".join(errors[-3:]))
