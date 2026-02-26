"""
Application settings – loaded from environment variables / .env file.
All secrets are read from the environment; defaults are safe for local dev only.
"""

from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── General ────────────────────────────────────────────────────────────
    app_name: str = Field("XAI Governance API", alias="APP_NAME")
    environment: str = Field("development", alias="ENVIRONMENT")
    port: int = Field(8000, alias="PORT")

    # ── Database ───────────────────────────────────────────────────────────
    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    mongo_db_name: str = Field("xai_platform", alias="MONGO_DB_NAME")

    # ── AI / OpenAI ────────────────────────────────────────────────────────
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")

    # ── Firebase Auth ──────────────────────────────────────────────────────
    firebase_project_id: str = Field(..., alias="FIREBASE_PROJECT_ID")
    firebase_private_key: str = Field(..., alias="FIREBASE_PRIVATE_KEY")
    firebase_client_email: str = Field(..., alias="FIREBASE_CLIENT_EMAIL")

    # ── CORS ───────────────────────────────────────────────────────────────
    # Accepts a comma-separated list of origins OR the special string "*".
    # Example:  BACKEND_CORS_ORIGINS=https://myapp.vercel.app,https://admin.myapp.com
    # Leaving it as "*" (default) allows all origins – fine for public APIs.
    backend_cors_origins: str = Field(
        "*",
        alias="BACKEND_CORS_ORIGINS",
    )

    # ── Uploads ────────────────────────────────────────────────────────────
    upload_dir: str = Field("uploads", alias="UPLOAD_DIR")
    max_upload_mb: int = Field(25, alias="MAX_UPLOAD_MB")

    # ── Timeouts & Rate Limits ─────────────────────────────────────────────
    request_timeout_seconds: int = Field(30, alias="REQUEST_TIMEOUT_SECONDS")
    chat_rate_limit: int = Field(30, alias="CHAT_RATE_LIMIT")
    chat_rate_window_seconds: int = Field(300, alias="CHAT_RATE_WINDOW_SECONDS")

    # ── Optional API Key (leave blank to disable) ──────────────────────────
    api_key: Optional[str] = Field(None, alias="API_KEY")

    # ── Computed properties ────────────────────────────────────────────────
    @property
    def cors_origins(self) -> List[str]:
        """
        Returns a list of allowed CORS origins.
        - "*"  → wildcard (allow all)
        - Comma-separated URLs → explicit whitelist
        """
        raw = self.backend_cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    # ── Validators ─────────────────────────────────────────────────────────
    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v.lower() not in allowed:
            raise ValueError(f"environment must be one of {allowed}")
        return v.lower()


settings = Settings()
