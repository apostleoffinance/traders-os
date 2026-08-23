from __future__ import annotations

from typing import Protocol


class ProviderError(Exception):
    def __init__(self, provider: str, message: str) -> None:
        super().__init__(f"{provider}: {message}")
        self.provider = provider
        self.message = message


class AIProvider(Protocol):
    name: str

    def available(self) -> bool: ...

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        """Return (raw_json_text, model_id). Raise ProviderError on failure."""
        ...
