from typing import Any

from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    success: bool = True
    data: Any | None = None
    message: str = ""


class ChatContext(BaseModel):
    metrics: dict = Field(default_factory=dict)
    shapSummary: dict = Field(default_factory=dict)
    biasSummary: dict = Field(default_factory=dict)
    driftSummary: dict = Field(default_factory=dict)
    trustScore: float | None = None


class ChatRequest(BaseModel):
    session_id: str = Field(default="default")
    message: str = Field(min_length=1, max_length=2000)
    context: ChatContext
