"""
Application settings loaded from environment variables.
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

    app_name: str = Field("XAI Governance API", alias="APP_NAME")
    environment: str = Field("development", alias="ENVIRONMENT")
    port: int = Field(8000, alias="PORT")

    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    mongo_db_name: str = Field("xai_platform", alias="MONGO_DB_NAME")

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")

    firebase_project_id: str = Field(..., alias="FIREBASE_PROJECT_ID")
    firebase_private_key: str = Field(..., alias="FIREBASE_PRIVATE_KEY")
    firebase_client_email: str = Field(..., alias="FIREBASE_CLIENT_EMAIL")

    backend_cors_origins: str = Field("*", alias="BACKEND_CORS_ORIGINS")

    upload_dir: str = Field("uploads", alias="UPLOAD_DIR")
    max_upload_mb: int = Field(50, alias="MAX_UPLOAD_MB")
    artifact_cache_dir: str = Field("uploads", alias="ARTIFACT_CACHE_DIR")
    strict_feature_compatibility: bool = Field(True, alias="STRICT_FEATURE_COMPATIBILITY")

    request_timeout_seconds: int = Field(30, alias="REQUEST_TIMEOUT_SECONDS")
    chat_rate_limit: int = Field(30, alias="CHAT_RATE_LIMIT")
    chat_rate_window_seconds: int = Field(300, alias="CHAT_RATE_WINDOW_SECONDS")
    shap_max_samples: int = Field(80, alias="SHAP_MAX_SAMPLES")
    shap_background_samples: int = Field(50, alias="SHAP_BACKGROUND_SAMPLES")
    shap_output_rows: int = Field(10, alias="SHAP_OUTPUT_ROWS")

    api_key: Optional[str] = Field(None, alias="API_KEY")

    @property
    def cors_origins(self) -> List[str]:
        raw = self.backend_cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def storage_backend(self) -> str:
        return "local"

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        allowed = {"development", "staging", "production"}
        if value.lower() not in allowed:
            raise ValueError(f"environment must be one of {allowed}")
        return value.lower()


settings = Settings()
