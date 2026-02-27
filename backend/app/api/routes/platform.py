from fastapi import APIRouter, Depends, File, Form, UploadFile, Request

from app.api.routes.analytics import compute_metrics, compute_shap
from app.api.routes.datasets import upload_dataset
from app.api.routes.drift import analyze_drift
from app.api.routes.governance import governance_analyze, trust_score
from app.api.routes.models import upload_model
from app.api.routes.reports import generate_report
from app.api.routes.system import audit_log
from app.core.security import verify_token
from app.schemas.platform import BiasRequest, DriftRequest, ModelDatasetRequest

router = APIRouter()


@router.post("/upload-model")
async def upload_model_alias(
    request: Request,
    name: str = Form(...),
    version: str = Form("v1"),
    target_column: str = Form("target"),
    file: UploadFile = File(...),
    user=Depends(verify_token),
):
    return await upload_model(request=request, name=name, version=version, target_column=target_column, file=file, user=user)


@router.post("/upload-dataset")
async def upload_dataset_alias(
    name: str = Form(...),
    version: str = Form("v1"),
    file: UploadFile = File(...),
    user=Depends(verify_token),
):
    return await upload_dataset(name=name, version=version, file=file, user=user)


@router.post("/compute-metrics")
async def compute_metrics_alias(payload: ModelDatasetRequest, user=Depends(verify_token)):
    return await compute_metrics(model_id=payload.model_id, dataset_id=payload.dataset_id, user=user)


@router.post("/compute-shap")
async def compute_shap_alias(payload: ModelDatasetRequest, user=Depends(verify_token)):
    return await compute_shap(model_id=payload.model_id, dataset_id=payload.dataset_id, user=user)


@router.post("/bias-analysis")
async def bias_analysis_alias(payload: BiasRequest, user=Depends(verify_token)):
    return await governance_analyze(
        model_id=payload.model_id,
        dataset_id=payload.dataset_id,
        sensitive_column=payload.sensitive_column,
        user=user,
    )


@router.post("/drift-analysis")
async def drift_analysis_alias(payload: DriftRequest, user=Depends(verify_token)):
    return await analyze_drift(
        baseline_dataset_id=payload.baseline_dataset_id,
        current_dataset_id=payload.current_dataset_id,
        user=user,
    )


@router.get("/trust-score")
async def trust_score_alias(model_id: str, dataset_id: str, user=Depends(verify_token)):
    return await trust_score(model_id=model_id, dataset_id=dataset_id, user=user)


@router.get("/audit-log")
async def audit_log_alias(limit: int = 100, action: str = "", entity_type: str = "", user=Depends(verify_token)):
    return await audit_log(limit=limit, action=action, entity_type=entity_type, user=user)


@router.post("/generate-report")
async def generate_report_alias(payload: ModelDatasetRequest, user=Depends(verify_token)):
    return await generate_report(model_id=payload.model_id, dataset_id=payload.dataset_id, user=user)
