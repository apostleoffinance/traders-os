from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Trader OS"
    app_env: str = "development"
    api_prefix: str = "/api"
    secret_key: str = "change-me-to-a-long-random-value"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+psycopg://trader:trader@localhost:5432/trader_os"

    default_timezone: str = "Africa/Lagos"

    storage_backend: str = "db"
    storage_local_path: str = "./data/uploads"
    storage_max_upload_bytes: int = 1_572_864  # 1.5 MiB — keeps Neon free tier usable
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""

    # AI providers — keys stay server-side. Empty keys are skipped at runtime.
    ai_provider_order: str = "gemini,openrouter,bazaarlink"
    ai_timeout_seconds: float = 45.0
    ai_prompt_version: str = "2026-08-21.v1"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"

    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o"
    openrouter_api_base: str = "https://openrouter.ai/api/v1"

    bazaarlink_api_key: str = ""
    bazaarlink_model: str = "google/gemini-2.0-flash"
    bazaarlink_api_base: str = "https://api.bazaarlink.ai/v1"

    # Market data — all optional. Empty OANDA keys keep Dukascopy-only FX.
    market_http_timeout_seconds: float = 8.0
    market_ohlcv_limit: int = 500
    oanda_api_key: str = ""
    oanda_account_id: str = ""
    oanda_environment: str = "practice"
    ccxt_exchanges: str = "binance,bybit,kraken"
    # FX conversion freshness for calculator (seconds). Stale rates refused unless opted in.
    fx_rate_fresh_seconds: int = 60
    fx_rate_recent_seconds: int = 300
    fx_quote_cache_ttl_seconds: int = 45
    fx_provider: str = "market"  # market = Dukascopy/CCXT chain; no paid FX API

    # Web Push — empty keys disable reminders. Private key stays server-side.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_mailto: str = "mailto:trader-os@localhost"
    cron_secret: str = ""
    journal_reminder_hour: int = 18
    web_origin: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local"}

    @property
    def push_configured(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    @property
    def public_web_origin(self) -> str:
        if self.web_origin.strip():
            return self.web_origin.strip().rstrip("/")
        origins = self.cors_origin_list
        return origins[0].rstrip("/") if origins else "http://localhost:3000"


settings = Settings()
