from pydantic import BaseModel, Field


class MetricsRequestQuery(BaseModel):
    model_id: str = Field(min_length=1)
    dataset_id: str = Field(min_length=1)


class MetricSummary(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float
    f1_score: float


class ShapFeatureImportance(BaseModel):
    feature: str
    value: float


class ShapRowValues(BaseModel):
    row_index: int
    values: dict[str, float]


class ShapSummary(BaseModel):
    features: list[str] = Field(default_factory=list)
    importance: list[float] = Field(default_factory=list)
    global_importance: list[ShapFeatureImportance]
    feature_importance: list[ShapFeatureImportance]
    shap_values: list[dict[str, float]]
    sample_size: int
    method: str
    model_type: str | None = None
    target_column: str | None = None


class MetricsData(MetricSummary):
    confusion_matrix: list[list[float | int]]
    target_column: str
    auc: float | None = None


class MetricsResponse(BaseModel):
    success: bool = True
    data: MetricsData


class ShapResponse(BaseModel):
    success: bool = True
    data: ShapSummary


class LocalContribution(BaseModel):
    feature: str
    value: float | str | int | None
    contribution: float


class LocalShapData(BaseModel):
    row_index: int
    prediction: list[float | int | str]
    probabilities: list[float] | None = None
    method: str
    contributions: list[LocalContribution]


class LocalShapResponse(BaseModel):
    success: bool = True
    data: LocalShapData
