from __future__ import annotations

import pytest

from app.core.config import settings
from app.main import validate_runtime_configuration


def test_production_rejects_default_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "secret_key", "change-me-to-a-long-random-value")

    with pytest.raises(RuntimeError, match="Production requires a unique SECRET_KEY"):
        validate_runtime_configuration()


def test_production_rejects_short_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "secret_key", "too-short")
    
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        validate_runtime_configuration()


def test_production_accepts_long_custom_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "secret_key", "a" * 48)
    monkeypatch.setattr(settings, "storage_backend", "db")

    validate_runtime_configuration()


def test_development_allows_example_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "secret_key", "change-me-to-a-long-random-value")
    monkeypatch.setattr(settings, "storage_backend", "db")

    validate_runtime_configuration()
