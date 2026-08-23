from __future__ import annotations

import httpx

from app.core.config import settings
from app.ai.providers.base import ProviderError


class OpenAICompatibleProvider:
    """Shared client for OpenRouter, BazaarLink, and any OpenAI-compatible gateway."""

    def __init__(
        self,
        *,
        name: str,
        api_key: str,
        model: str,
        base_url: str,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        self.name = name
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.extra_headers = extra_headers or {}

    def available(self) -> bool:
        return bool(self.api_key and self.model)

    def _post(self, headers: dict[str, str], payload: dict) -> httpx.Response:
        try:
            with httpx.Client(timeout=settings.ai_timeout_seconds) as client:
                return client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
        except httpx.HTTPError as exc:
            raise ProviderError(self.name, f"network error: {exc}") from exc

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        if not self.available():
            raise ProviderError(self.name, "not configured")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }
        messages = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"Respond with JSON only for schema {schema_name}.\n\n{user}",
            },
        ]
        payload = {
            "model": self.model,
            "temperature": 0.2,
            "max_tokens": 2000,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        res = self._post(headers, payload)
        # Some OpenRouter/BazaarLink models reject response_format; retry like a plain chat call.
        if res.status_code == 400 and "response_format" in (res.text or "").lower():
            payload.pop("response_format", None)
            res = self._post(headers, payload)
        if res.status_code >= 500 or res.status_code in {408, 429}:
            raise ProviderError(self.name, f"http {res.status_code}")
        if res.status_code >= 400:
            raise ProviderError(self.name, f"http {res.status_code}: {res.text[:300]}")
        data = res.json()
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(self.name, "malformed completion payload") from exc
        if not text:
            raise ProviderError(self.name, "empty completion")
        return text, self.model
