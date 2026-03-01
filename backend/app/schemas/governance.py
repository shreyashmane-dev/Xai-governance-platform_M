from pydantic import BaseModel, Field


class GovernanceRequestQuery(BaseModel):
    model_id: str = Field(min_length=1)
    dataset_id: str = Field(min_length=1)
    sensitive_column: str = ""


class GovernanceSummary(BaseModel):
    dataset_size: int
    feature_count: int
    missing_values: int
    model_type: str


class GovernanceAnalyzeData(BaseModel):
    tenant_id: str
    model_id: str
    dataset_id: str
    dataset_size: int
    feature_count: int
    missing_values: int
    model_type: str
    prediction_sample: list[float | int | str]
    target_column: str | None = None
    metrics: dict = Field(default_factory=dict)
    fairness_score: float
    quality_score: float
    trust_score: float
    risk_classification: str
    bias_findings: list[dict] = Field(default_factory=list)
    subgroup_analysis: list[dict] = Field(default_factory=list)
    created_at: str | None = None


class GovernanceAnalyzeResponse(BaseModel):
    success: bool = True
    data: GovernanceAnalyzeData


class TrustScoreComponents(BaseModel):
    performance_score: float
    fairness_score: float


class TrustScoreData(BaseModel):
    trust_score: float
    trust_level: str
    components: TrustScoreComponents


class TrustScoreResponse(BaseModel):
    success: bool = True
    data: TrustScoreData
