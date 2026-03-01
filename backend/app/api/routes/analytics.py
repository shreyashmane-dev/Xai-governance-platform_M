import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.schemas.analytics import MetricsResponse
from app.services.artifact_service import (
    align_features,
    find_dataset_doc,
    find_model_doc,
    infer_target_column,
    load_dataset,
    load_model,
)
from app.services.ml_service import compute_classification_metrics
from app.services.shap_service import run_shap_analysis
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


@router.post("/metrics", response_model=MetricsResponse)
async def compute_metrics(
    model_id: str = Query(..., min_length=1),
    dataset_id: str = Query(..., min_length=1),
    user=Depends(verify_token),
):
    db = get_db()
    model_doc = await find_model_doc(db, user["tenant_id"], model_id)
    dataset_doc = await find_dataset_doc(db, user["tenant_id"], dataset_id)

    if not model_doc:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    if not dataset_doc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {dataset_id}")

    model = load_model(model_doc, model_id)
    df = load_dataset(dataset_doc, dataset_id)
    target_column = infer_target_column(model_doc, df, model)
    if not target_column or target_column not in df.columns:
        raise HTTPException(status_code=400, detail="Unable to infer a valid target column from dataset/model")

    y_true = df[target_column]
    x = align_features(model, df.drop(columns=[target_column]))
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no feature columns")

    try:
        y_pred = model.predict(x)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model prediction failed: {exc}") from exc

    y_prob = None
    if hasattr(model, "predict_proba"):
        try:
            y_prob = model.predict_proba(x)
        except Exception:
            y_prob = None

    metrics = compute_classification_metrics(y_true, y_pred, y_prob)
    metrics["target_column"] = target_column

    doc = {
        "tenant_id": user["tenant_id"],
        "model_id": model_id,
        "dataset_id": dataset_id,
        "metrics": metrics,
        "created_at": utc_now(),
    }
    await db.metrics.insert_one(doc)
    await write_audit(db, user["tenant_id"], user["uid"], "compute_metrics", "model", model_id, {"dataset_id": dataset_id})
    return {"success": True, "data": metrics}


@router.post("/shap")
async def compute_shap(
    model_id: str = Query(..., min_length=1),
    dataset_id: str = Query(..., min_length=1),
    row_index: int = Query(0, ge=0),
    user=Depends(verify_token),
):
    db = get_db()
    model_doc = await find_model_doc(db, user["tenant_id"], model_id)
    dataset_doc = await find_dataset_doc(db, user["tenant_id"], dataset_id)

    if not model_doc:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    if not dataset_doc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {dataset_id}")

    summary = run_shap_analysis(
        model_id=model_id,
        dataset_id=dataset_id,
        model_doc=model_doc,
        dataset_doc=dataset_doc,
        row_index=row_index,
        max_rows=min(200, max(10, int(settings.shap_max_samples))),
    )

    doc = {
        "tenant_id": user["tenant_id"],
        "model_id": model_id,
        "dataset_id": dataset_id,
        "summary": summary,
        "created_at": utc_now(),
    }
    await db.shap_reports.insert_one(doc)
    await write_audit(db, user["tenant_id"], user["uid"], "compute_shap", "model", model_id, {"dataset_id": dataset_id})
    return {"success": True, "data": summary}


@router.get("/shap/local")
async def compute_shap_local(
    model_id: str = Query(..., min_length=1),
    dataset_id: str = Query(..., min_length=1),
    row_index: int = Query(0, ge=0),
    user=Depends(verify_token),
):
    db = get_db()
    model_doc = await find_model_doc(db, user["tenant_id"], model_id)
    dataset_doc = await find_dataset_doc(db, user["tenant_id"], dataset_id)
    if not model_doc:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    if not dataset_doc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {dataset_id}")

    shap_bundle = run_shap_analysis(
        model_id=model_id,
        dataset_id=dataset_id,
        model_doc=model_doc,
        dataset_doc=dataset_doc,
        row_index=row_index,
        max_rows=min(200, max(10, int(settings.shap_max_samples))),
    )
    local = shap_bundle.get("local", {})
    contributions = [
        {
            "feature": row.get("feature"),
            "value": row.get("value"),
            "contribution": row.get("shap_impact"),
        }
        for row in (local.get("contributions") or [])
    ]
    result = {
        "row_index": int(local.get("row_index", row_index)),
        "prediction": [local.get("prediction")],
        "probabilities": None,
        "method": "shap",
        "base_value": local.get("base_value"),
        "waterfall_plot": local.get("waterfall_plot"),
        "force_plot": local.get("force_plot"),
        "contributions": contributions[:30],
    }
    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "compute_shap_local",
        "model",
        model_id,
        {"dataset_id": dataset_id, "row_index": row_index, "method": "shap"},
    )
    return {"success": True, "data": result}


@router.get("/history")
async def model_history(model_id: str = Query(...), user=Depends(verify_token)):
    db = get_db()
    cursor = db.metrics.find({"model_id": model_id, "tenant_id": user["tenant_id"]}).sort("created_at", 1)
    history = await cursor.to_list(100)
    for item in history:
        item["id"] = str(item.pop("_id"))
    return {"success": True, "data": history}


@router.get("/summary")
async def latest_summary(user=Depends(verify_token)):
    db = get_db()
    metrics = await db.metrics.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])
    shap = await db.shap_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])
    governance = await db.governance_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])
    drift = await db.drift_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])

    return {
        "success": True,
        "data": {
            "metrics": (metrics or {}).get("metrics"),
            "shapSummary": (shap or {}).get("summary"),
            "biasSummary": (governance or {}).get("bias_findings", []),
            "driftSummary": {"alert_count": (drift or {}).get("alert_count", 0), "alerts": (drift or {}).get("alerts", [])},
            "trustScore": (governance or {}).get("trust_score"),
        },
    }
