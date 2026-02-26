import pickle

import numpy as np
import pandas as pd
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.compatibility import check_feature_compatibility
from app.utils.storage import ArtifactStorageError, resolve_artifact_path
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
    # Add missing training features as neutral values to keep governance analysis executable.
    missing = [c for c in model_features if c not in x.columns]
    for col in missing:
        x[col] = 0.0
    return x[model_features]


def _rate_by_group(values: pd.Series, preds: pd.Series) -> dict:
    out = {}
    for key, idx in values.groupby(values).groups.items():
        group_preds = preds.loc[idx]
        out[str(key)] = float(np.mean(group_preds == 1))
    return out


def _compute_explainability_score(shap_summary: dict | None) -> float:
    if not shap_summary:
        return 40.0
    importance = shap_summary.get("global_importance", [])
    if not importance:
        return 40.0
    top = importance[:10]
    total = sum(max(float(x.get("value", 0.0)), 0.0) for x in top) or 1.0
    concentration = max(float(top[0].get("value", 0.0)), 0.0) / total
    # Less concentrated importance usually indicates broader, more stable explanation structure.
    return round(max(0.0, min(100.0, 100.0 * (1 - concentration * 0.7))), 2)


@router.post("/analyze")
async def governance_analyze(
    model_id: str = Query(...),
    dataset_id: str = Query(...),
    sensitive_column: str = Query(""),
    user=Depends(verify_token),
):
    try:
        if not ObjectId.is_valid(model_id) or not ObjectId.is_valid(dataset_id):
            raise HTTPException(status_code=400, detail="Invalid model_id or dataset_id")

        db = get_db()
        model_doc = await db.models.find_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
        data_doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
        metrics_doc = await db.metrics.find_one(
            {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
            sort=[("created_at", -1)],
        )

        if not model_doc or not data_doc:
            raise HTTPException(status_code=404, detail="Model or dataset not found")
        if not metrics_doc:
            raise HTTPException(status_code=400, detail="Run metrics before governance analysis")

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

        x = df.drop(columns=[target])
        x = _align_features(model, x)
        y_true = df[target]
        try:
            y_pred = pd.Series(model.predict(x), index=df.index)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Model prediction failed: {exc}") from exc

        bias_findings = []
        fairness_score = 100.0
        subgroup_analysis = []

        if sensitive_column and sensitive_column in df.columns:
            distribution = df[sensitive_column].value_counts(normalize=True).to_dict()
            positive_label = 1 if 1 in set(y_true.unique().tolist()) else y_true.mode(dropna=True).iloc[0]
            rates = {}
            for key, idx in df[sensitive_column].groupby(df[sensitive_column]).groups.items():
                group_preds = y_pred.loc[idx]
                rates[str(key)] = float(np.mean(group_preds == positive_label))
            dp_diff = float(max(rates.values()) - min(rates.values())) if len(rates) > 1 else 0.0

            tpr_rates = {}
            positive_mask = y_true == positive_label
            for key, idx in df[sensitive_column].groupby(df[sensitive_column]).groups.items():
                group_pos = positive_mask.loc[idx]
                denom = int(group_pos.sum())
                if denom == 0:
                    continue
                group_tp = int(((y_pred.loc[idx] == positive_label) & group_pos).sum())
                tpr_rates[str(key)] = float(group_tp / denom)

            eo_diff = float(max(tpr_rates.values()) - min(tpr_rates.values())) if len(tpr_rates) > 1 else 0.0
            fairness_score = max(0.0, 100.0 - ((dp_diff * 100.0 * 0.6) + (eo_diff * 100.0 * 0.4)))

            bias_findings.append(
                {
                    "sensitive_column": sensitive_column,
                    "distribution": distribution,
                    "demographic_parity_diff": dp_diff,
                    "equal_opportunity_diff": eo_diff,
                }
            )

            subgroup_analysis = [
                {"group": group, "positive_prediction_rate": rate, "true_positive_rate": tpr_rates.get(group)}
                for group, rate in rates.items()
            ]

        metrics = metrics_doc["metrics"]
        quality_score = float(metrics.get("f1", 0) * 100)
        drift_doc = await db.drift_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])
        drift_penalty = min(20.0, float((drift_doc or {}).get("alert_count", 0) * 2.0))

        trust_score = round((quality_score * 0.5) + (fairness_score * 0.4) + (max(0.0, 100 - drift_penalty) * 0.1), 2)
        risk = "low" if trust_score >= 80 else ("medium" if trust_score >= 60 else "high")
        detailed_reasoning = {
            "quality_component": {
                "score": round(quality_score, 2),
                "reason": "Derived from latest weighted F1 metric scaled to 0-100.",
            },
            "fairness_component": {
                "score": round(fairness_score, 2),
                "reason": (
                    "Based on demographic parity and equal opportunity differences."
                    if sensitive_column and sensitive_column in df.columns
                    else "Sensitive column not provided; fairness defaults to baseline."
                ),
            },
            "drift_component": {
                "penalty": round(drift_penalty, 2),
                "reason": "Penalty increases with drift alert count from latest drift analysis.",
            },
            "trust_formula": "trust = 0.5*quality + 0.4*fairness + 0.1*(100-drift_penalty)",
        }
        recommendations = [
            "If trust < 60, retrain model with refreshed data and rerun governance.",
            "If fairness score < 70, run subgroup-level mitigation and threshold review.",
            "If drift penalty > 10, update baseline dataset and monitor weekly.",
        ]

        report = {
            "tenant_id": user["tenant_id"],
            "model_id": model_id,
            "dataset_id": dataset_id,
            "fairness_score": round(fairness_score, 2),
            "quality_score": round(quality_score, 2),
            "drift_penalty": round(drift_penalty, 2),
            "trust_score": trust_score,
            "risk_classification": risk,
            "bias_findings": bias_findings,
            "subgroup_analysis": subgroup_analysis,
            "detailed_reasoning": detailed_reasoning,
            "recommendations": recommendations,
            "created_at": utc_now(),
        }
        await db.governance_reports.insert_one(report)
        try:
            await write_audit(db, user["tenant_id"], user["uid"], "governance_analyze", "model", model_id, {"dataset_id": dataset_id})
        except Exception:
            pass
        return JSONResponse(content=_plain({"success": True, "data": report}))
    except HTTPException as exc:
        if exc.status_code in {400, 404}:
            raise
        fallback = {
            "tenant_id": user.get("tenant_id"),
            "model_id": model_id,
            "dataset_id": dataset_id,
            "fairness_score": 0.0,
            "quality_score": 0.0,
            "drift_penalty": 20.0,
            "trust_score": 0.0,
            "risk_classification": "high",
            "bias_findings": [{"warning": "Governance fallback: selected artifacts are not fully compatible."}],
            "subgroup_analysis": [],
            "detailed_reasoning": {
                "reason": "Fallback mode used due incompatible model/dataset artifacts.",
                "trust_formula": "trust not computable in strict mode; fallback assigned.",
            },
            "recommendations": [
                "Re-upload compatible model and dataset with matching feature schema.",
                "Run metrics first, then rerun governance.",
            ],
            "created_at": utc_now(),
            "fallback": True,
        }
        return JSONResponse(content=_plain({"success": True, "data": fallback}))
    except Exception as exc:
        fallback = {
            "tenant_id": user.get("tenant_id"),
            "model_id": model_id,
            "dataset_id": dataset_id,
            "fairness_score": 0.0,
            "quality_score": 0.0,
            "drift_penalty": 20.0,
            "trust_score": 0.0,
            "risk_classification": "high",
            "bias_findings": [{"warning": f"Governance fallback activated: {exc}"}],
            "subgroup_analysis": [],
            "detailed_reasoning": {
                "reason": f"Fallback mode used due runtime error: {exc}",
                "trust_formula": "trust not computable in strict mode; fallback assigned.",
            },
            "recommendations": [
                "Validate uploaded artifacts and dataset target column.",
                "Re-run metrics and governance after fixing schema mismatches.",
            ],
            "created_at": utc_now(),
            "fallback": True,
        }
        return JSONResponse(content=_plain({"success": True, "data": fallback}))


@router.get("/trust-score")
async def trust_score(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
    db = get_db()
    metrics_doc = await db.metrics.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    shap_doc = await db.shap_reports.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    gov_doc = await db.governance_reports.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    drift_doc = await db.drift_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])

    if not metrics_doc:
        raise HTTPException(status_code=400, detail="Metrics required before trust score calculation")

    metrics = metrics_doc.get("metrics", {})
    performance = round(float(metrics.get("f1", 0.0)) * 100.0, 2)
    fairness = float((gov_doc or {}).get("fairness_score", 50.0))
    explainability = _compute_explainability_score((shap_doc or {}).get("summary", {}))
    drift_risk = min(100.0, float((drift_doc or {}).get("alert_count", 0)) * 5.0)
    drift_safety = round(100.0 - drift_risk, 2)

    cv_doc = await db.metrics.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id, "metrics.stability_score": {"$exists": True}},
        sort=[("created_at", -1)],
    )
    stability = float((cv_doc or {}).get("metrics", {}).get("stability_score", performance))

    trust = round((0.30 * performance) + (0.20 * explainability) + (0.20 * fairness) + (0.15 * drift_safety) + (0.15 * stability), 2)
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
            "performance_score": performance,
            "explainability_score": explainability,
            "fairness_score": fairness,
            "drift_safety_score": drift_safety,
            "stability_score": stability,
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
