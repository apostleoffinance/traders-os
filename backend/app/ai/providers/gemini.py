from __future__ import annotations

import httpx

from app.ai.providers.base import ProviderError
from app.core.config import settings


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        api_base: str | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model or settings.gemini_model
        self.api_base = (api_base or settings.gemini_api_base).rstrip("/")

    def available(self) -> bool:
        return bool(self.api_key and self.model)

    def complete_json(self, *, system: str, user: str, schema_name: str) -> tuple[str, str]:
        if not self.available():
            raise ProviderError(self.name, "not configured")
        url = f"{self.api_base}/models/{self.model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"Respond with JSON only for schema {schema_name}.\n\n{user}"}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        try:
            with httpx.Client(timeout=settings.ai_timeout_seconds) as client:
                res = client.post(url, params={"key": self.api_key}, json=payload)
        except httpx.HTTPError as exc:
            raise ProviderError(self.name, f"network error: {exc}") from exc
        if res.status_code >= 500 or res.status_code in {408, 429}:
            raise ProviderError(self.name, f"http {res.status_code}")
        if res.status_code >= 400:
            raise ProviderError(self.name, f"http {res.status_code}: {res.text[:300]}")
        data = res.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(self.name, "malformed Gemini payload") from exc
        if not text:
            raise ProviderError(self.name, "empty completion")
        return text, self.model
