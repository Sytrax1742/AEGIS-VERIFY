from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GCP_PROJECT_ID: str = Field(..., min_length=1)
    GCP_REGION: str = Field(default="us-central1")
    CORS_ORIGINS: list[str] = Field(default_factory=list)

    @field_validator("GCP_PROJECT_ID")
    @classmethod
    def validate_project_id(cls, value: str) -> str:
        project_id = value.strip()
        if not project_id:
            raise ValueError("GCP_PROJECT_ID must be set and non-empty")
        return project_id

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


# Fail fast on boot if required environment variables are missing or invalid.
settings = Settings()
