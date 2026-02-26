import pickle

import numpy as np
import pandas as pd
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.security import verify_token
from app.core.config import settings
from app.db.mongo import get_db
from app.services.ml_service import compute_classification_metrics, compute_shap_summary
from app.utils.compatibility import check_feature_compatibility
from app.utils.storage import ArtifactStorageError, resolve_artifact_path
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


def _oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid id: {value}")
    return ObjectId(value)


def _load_model(doc: dict):
    try:
        path = resolve_artifact_path(doc, "model")
        with open(path, "rb") as src:
            return pickle.load(src)
    except ArtifactStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to load model artifact: {exc}") from exc


def _load_dataset(doc: dict) -> pd.DataFrame:
    try:
        path = resolve_artifact_path(doc, "dataset")
        return pd.read_csv(path)
    except ArtifactStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}") from exc


def _align_features(model, x: pd.DataFrame) -> pd.DataFrame:
    model_features = list(getattr(model, "feature_names_in_", []) or [])
    if not model_features:
        return x
    # Add missing columns with neutral defaults so older/newer dataset versions still run.
    missing = [c for c in model_features if c not in x.columns]
    for col in missing:
        x[col] = 0.0
    return x[model_features]


@router.post("/metrics")
async def compute_metrics(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
    db = get_db()
    model_doc = await db.models.find_one({"_id": _oid(model_id), "tenant_id": user["tenant_id"]})
    data_doc = await db.datasets.find_one({"_id": _oid(dataset_id), "tenant_id": user["tenant_id"]})
    if not model_doc or not data_doc:
        raise HTTPException(status_code=404, detail="Model or dataset not found")

    model = _load_model(model_doc)
    df = _load_dataset(data_doc)
    target = model_doc.get("target_column", "target")
    if target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column {target} missing in dataset")
    compatibility = check_feature_compatibility(model_doc, df, target, model=model)
    if settings.strict_feature_compatibility and not compatibility.compatible:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Model and dataset feature schema mismatch",
                "missing_features": compatibility.missing_features[:50],
                "expected_feature_count": len(compatibility.expected_features),
                "dataset_feature_count": len(compatibility.dataset_features),
            },
        )

    y_true = df[target]
    x = df.drop(columns=[target])
    x = _align_features(model, x)
    try:
        y_pred = model.predict(x)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model prediction failed for selected dataset: {exc}") from exc
    y_prob = model.predict_proba(x) if hasattr(model, "predict_proba") else None

    metrics = compute_classification_metrics(y_true, y_pred, y_prob)
    record = {
        "tenant_id": user["tenant_id"],
        "model_id": model_id,
        "dataset_id": dataset_id,
        "metrics": metrics,
        "created_at": utc_now(),
    }
    await db.metrics.insert_one(record)
    await write_audit(db, user["tenant_id"], user["uid"], "compute_metrics", "model", model_id, {"dataset_id": dataset_id})
    return {"success": True, "data": metrics}


@router.post("/shap")
async def compute_shap(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
    try:
        db = get_db()
        model_doc = await db.models.find_one({"_id": _oid(model_id), "tenant_id": user["tenant_id"]})
        data_doc = await db.datasets.find_one({"_id": _oid(dataset_id), "tenant_id": user["tenant_id"]})
        if not model_doc or not data_doc:
            raise HTTPException(status_code=404, detail="Model or dataset not found")

        model = _load_model(model_doc)
        df = _load_dataset(data_doc)
        target = model_doc.get("target_column", "target")
        compatibility = check_feature_compatibility(model_doc, df, target, model=model)
        if settings.strict_feature_compatibility and not compatibility.compatible:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Model and dataset feature schema mismatch",
                    "missing_features": compatibility.missing_features[:50],
                },
            )
        x = df.drop(columns=[target]) if target in df.columns else df
        x = _align_features(model, x)
        if x.empty:
            raise HTTPException(status_code=400, detail="Dataset has no feature columns for SHAP computation")
        x_sample = x.head(min(len(x), 200))
        try:
            summary = compute_shap_summary(model, x_sample.to_numpy(), list(x_sample.columns))
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"SHAP computation failed: {exc}") from exc

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
    except HTTPException as exc:
        if exc.status_code in {400, 404}:
            raise
        return JSONResponse(
            content={
                "success": True,
                "data": {
                    "global_importance": [],
                    "sample_size": 0,
                    "method": "error_fallback",
                    "warning": "SHAP could not be computed for the selected model/dataset. Re-upload compatible assets.",
                },
            }
        )
    except Exception as exc:
        return JSONResponse(
            content={
                "success": True,
                "data": {
                    "global_importance": [],
                    "sample_size": 0,
                    "method": "error_fallback",
                    "warning": f"SHAP endpoint fallback activated: {exc}",
                },
            }
        )


@router.get("/shap/local")
async def compute_shap_local(
    model_id: str = Query(...),
    dataset_id: str = Query(...),
    row_index: int = Query(0, ge=0),
    user=Depends(verify_token),
):
    db = get_db()
    model_doc = await db.models.find_one({"_id": _oid(model_id), "tenant_id": user["tenant_id"]})
    data_doc = await db.datasets.find_one({"_id": _oid(dataset_id), "tenant_id": user["tenant_id"]})
    if not model_doc or not data_doc:
        raise HTTPException(status_code=404, detail="Model or dataset not found")

    model = _load_model(model_doc)
    df = _load_dataset(data_doc)
    target = model_doc.get("target_column", "target")
    compatibility = check_feature_compatibility(model_doc, df, target, model=model)
    if settings.strict_feature_compatibility and not compatibility.compatible:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Model and dataset feature schema mismatch",
                "missing_features": compatibility.missing_features[:50],
            },
        )
    x = df.drop(columns=[target]) if target in df.columns else df
    x = _align_features(model, x)
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no feature rows")
    if row_index >= len(x):
        raise HTTPException(status_code=400, detail=f"row_index out of range (max {len(x)-1})")

    row = x.iloc[[row_index]]
    feature_names = list(row.columns)
    values = row.iloc[0].to_dict()

    method = "perturbation_fallback"
    contributions = []
    try:
        import shap

        explainer = shap.Explainer(model, x.head(min(len(x), 100)))
        shap_values = explainer(row).values
        arr = np.asarray(shap_values)
        if arr.ndim == 3:
            arr = np.mean(arr, axis=2)
        vec = arr[0]
        method = "shap"
        contributions = [
            {"feature": feature_names[i], "value": float(values.get(feature_names[i])), "contribution": float(vec[i])}
            for i in range(len(feature_names))
        ]
    except Exception:
        try:
            baseline_pred = model.predict(row)[0]
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Model prediction failed for local explanation: {exc}") from exc

        for i, name in enumerate(feature_names):
            perturbed = row.copy()
            if pd.api.types.is_numeric_dtype(x[name]):
                perturbed.iloc[0, i] = float(x[name].median(skipna=True))
            else:
                mode = x[name].mode(dropna=True)
                perturbed.iloc[0, i] = mode.iloc[0] if not mode.empty else perturbed.iloc[0, i]
            try:
                alt_pred = model.predict(perturbed)[0]
                delta = float(alt_pred) - float(baseline_pred)
            except Exception:
                delta = 0.0
            contributions.append({"feature": name, "value": values.get(name), "contribution": delta})

    contributions = sorted(contributions, key=lambda item: abs(item["contribution"]), reverse=True)

    prediction = model.predict(row)
    probs = model.predict_proba(row).tolist()[0] if hasattr(model, "predict_proba") else None
    result = {
        "row_index": row_index,
        "prediction": prediction.tolist(),
        "probabilities": probs,
        "method": method,
        "contributions": contributions[:30],
    }
    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "compute_shap_local",
        "model",
        model_id,
        {"dataset_id": dataset_id, "row_index": row_index, "method": method},
    )
    return {"success": True, "data": result}


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
