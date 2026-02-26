from pydantic import BaseModel, Field


class ModelDatasetRequest(BaseModel):
    model_id: str = Field(min_length=8)
    dataset_id: str = Field(min_length=8)


class DriftRequest(BaseModel):
    baseline_dataset_id: str = Field(min_length=8)
    current_dataset_id: str = Field(min_length=8)


class BiasRequest(ModelDatasetRequest):
    sensitive_column: str = ""
