from datetime import datetime
import csv
import json
from io import StringIO

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.security import verify_token
from app.db.mongo import get_db
from app.schemas.governance import GovernanceAnalyzeResponse, TrustScoreResponse
from app.services.artifact_service import (
    align_features,
    find_dataset_doc,
    find_model_doc,
    infer_target_column,
    load_dataset,
    load_model,
)
from app.services.ml_service import compute_classification_metrics
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


def _plain(value):
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, np.generic):
        return value.item()
    return value


@router.post("/analyze", response_model=GovernanceAnalyzeResponse)
async def governance_analyze(
    model_id: str = Query(..., min_length=1),
    dataset_id: str = Query(..., min_length=1),
    sensitive_column: str = Query(""),
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
    x = df.drop(columns=[target_column]) if target_column and target_column in df.columns else df.copy()
    x = align_features(model, x)
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no feature columns")

    try:
        predictions = model.predict(x)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model prediction failed: {exc}") from exc

    prediction_sample = [float(v) if isinstance(v, (np.floating, float, int, np.integer)) else str(v) for v in predictions[:10]]
    bias_findings = []
    subgroup_analysis = []
    fairness_score = 50.0

    if sensitive_column and sensitive_column in df.columns and target_column and target_column in df.columns:
        y_true = df[target_column]
        y_pred = pd.Series(predictions, index=df.index)
        positive_label = 1 if 1 in set(pd.Series(y_true).dropna().unique().tolist()) else pd.Series(y_true).mode(dropna=True).iloc[0]

        rates = {}
        for key, idx in df[sensitive_column].groupby(df[sensitive_column]).groups.items():
            group_preds = y_pred.loc[idx]
            rates[str(key)] = float(np.mean(group_preds == positive_label))

        dp_diff = float(max(rates.values()) - min(rates.values())) if len(rates) > 1 else 0.0
        fairness_score = max(0.0, 100.0 - (dp_diff * 100.0))
        bias_findings = [
            {
                "sensitive_column": sensitive_column,
                "distribution": df[sensitive_column].value_counts(normalize=True).to_dict(),
                "demographic_parity_diff": dp_diff,
            }
        ]
        subgroup_analysis = [{"group": group, "positive_prediction_rate": rate} for group, rate in rates.items()]

    metrics = {}
    quality_score = 0.0
    if target_column and target_column in df.columns:
        metrics = compute_classification_metrics(df[target_column], predictions, None)
        quality_score = float(metrics.get("f1_score", metrics.get("f1", 0.0))) * 100.0

    missing_values = int(df.isna().sum().sum())
    dataset_size = int(len(df))
    feature_count = int(x.shape[1])
    model_type = model.__class__.__name__

    trust_score = round((0.6 * quality_score) + (0.4 * fairness_score), 2)
    risk = "low" if trust_score >= 80 else ("medium" if trust_score >= 60 else "high")

    report = {
        "tenant_id": user["tenant_id"],
        "model_id": model_id,
        "dataset_id": dataset_id,
        "dataset_size": dataset_size,
        "feature_count": feature_count,
        "missing_values": missing_values,
        "model_type": model_type,
        "prediction_sample": prediction_sample,
        "target_column": target_column,
        "metrics": metrics,
        "fairness_score": round(fairness_score, 2),
        "quality_score": round(quality_score, 2),
        "trust_score": trust_score,
        "risk_classification": risk,
        "bias_findings": bias_findings,
        "subgroup_analysis": subgroup_analysis,
        "created_at": utc_now(),
    }

    await db.governance_reports.insert_one(report)
    await write_audit(db, user["tenant_id"], user["uid"], "governance_analyze", "model", model_id, {"dataset_id": dataset_id})

    return JSONResponse(content=_plain({"success": True, "data": report}))


@router.get("/trust-score", response_model=TrustScoreResponse)
async def trust_score(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
    db = get_db()
    gov_doc = await db.governance_reports.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    if not gov_doc:
        raise HTTPException(status_code=400, detail="Run governance analysis before trust score calculation")

    fairness = float(gov_doc.get("fairness_score", 0.0))
    quality = float(gov_doc.get("quality_score", 0.0))
    trust = float(gov_doc.get("trust_score", 0.0))
    if trust < 40:
        level = "CRITICAL RISK"
    elif trust < 60:
        level = "LOW"
    elif trust < 80:
        level = "MODERATE"
    else:
        level = "HIGH"

    result = {
        "trust_score": trust,
        "trust_level": level,
        "components": {
            "performance_score": round(quality, 2),
            "fairness_score": round(fairness, 2),
        },
    }
    await db.trust_scores.insert_one(
        {
            "tenant_id": user["tenant_id"],
            "model_id": model_id,
            "dataset_id": dataset_id,
            "result": result,
            "created_at": utc_now(),
        }
    )
    await write_audit(db, user["tenant_id"], user["uid"], "trust_score_compute", "model", model_id, {"dataset_id": dataset_id})
    return {"success": True, "data": result}


@router.get("/audit/download")
async def download_audit_logs(user=Depends(verify_token)):
    db = get_db()
    rows = await db.audit_logs.find({"tenant_id": user["tenant_id"]}).sort("created_at", -1).to_list(5000)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["timestamp", "model_id", "dataset_id", "action", "status", "details"])

    for row in rows:
        metadata = row.get("metadata") or {}
        model_id = metadata.get("model_id") or (row.get("resource_id") if row.get("resource_type") == "model" else "")
        dataset_id = metadata.get("dataset_id") or ""
        action = row.get("action", "")
        status = row.get("status") or "success"
        details = {
            "resource_type": row.get("resource_type"),
            "resource_id": row.get("resource_id"),
            "metadata": metadata,
        }
        created_at = row.get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        writer.writerow(
            [
                created_at,
                model_id,
                dataset_id,
                action,
                status,
                json.dumps(details, default=str),
            ]
        )

    content = buffer.getvalue()
    buffer.close()

    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit_logs.csv"'},
    )
