from pydantic import BaseModel


class ModelMetadata(BaseModel):
    name: str
    target_column: str | None = None
