"""
IntentFoundry — core configuration.
All settings are read from environment variables with sensible defaults for local dev.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ─────────────────────────────────────────────
    app_name: str = "IntentFoundry"
    app_version: str = "0.1.0"
    environment: Literal["development", "testing", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # ── API ─────────────────────────────────────────────────────
    api_prefix: str = "/api/v1"
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:8000"]

    # ── Auth ────────────────────────────────────────────────────
    secret_key: str = Field(
        default="dev-secret-change-in-production-please",
        description="JWT signing secret — MUST be overridden in production",
    )
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    api_key_prefix: str = "if_"  # intentfoundry_ key prefix

    # ── Database ────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./intentfoundry_dev.db"
    # For PostgreSQL: postgresql+asyncpg://user:password@localhost/intentfoundry
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_echo: bool = False  # Set True to log all SQL (debug only)

    # ── Redis ───────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False  # Disabled by default for simple local dev
    telemetry_channel_prefix: str = "if:telemetry:"
    event_channel_prefix: str = "if:events:"

    # ── Telemetry ───────────────────────────────────────────────
    telemetry_retention_days: int = 90
    sse_keepalive_seconds: int = 15
    sse_max_connections_per_project: int = 50

    # ── Fitness functions ────────────────────────────────────────
    fitness_check_timeout_seconds: int = 30
    max_fitness_functions_per_project: int = 50

    # ── Specs ────────────────────────────────────────────────────
    max_spec_size_bytes: int = 512_000       # 512 KB
    max_specs_per_project: int = 500
    spec_version_retention: int = 100        # Keep last N versions

    # ── ADRs ─────────────────────────────────────────────────────
    max_adrs_per_project: int = 200

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        # Accept both asyncpg and aiosqlite URLs
        return v

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_testing(self) -> bool:
        return self.environment == "testing"


@lru_cache
def get_settings() -> Settings:
    return Settings()
