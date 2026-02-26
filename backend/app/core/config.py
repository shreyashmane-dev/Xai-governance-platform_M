from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "XAI Governance API"
    environment: str = "development"
    port: int = Field(8000, alias="PORT")

    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    mongo_db_name: str = Field("xai_platform", alias="MONGO_DB_NAME")

    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")

    firebase_project_id: str = Field(..., alias="FIREBASE_PROJECT_ID")
    firebase_private_key: str = Field(..., alias="FIREBASE_PRIVATE_KEY")
    firebase_client_email: str = Field(..., alias="FIREBASE_CLIENT_EMAIL")

    backend_cors_origins: str = Field(
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
        alias="BACKEND_CORS_ORIGINS",
    )
    upload_dir: str = "uploads"
    max_upload_mb: int = 25

    request_timeout_seconds: int = 30
    chat_rate_limit: int = 30
    chat_rate_window_seconds: int = 300
    api_key: Optional[str] = Field(None, alias="API_KEY")


settings = Settings()
