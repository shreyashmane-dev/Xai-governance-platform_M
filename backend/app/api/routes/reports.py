import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.security import verify_token
from app.db.mongo import get_db
from app.services.artifact_service import (
    align_features,
    find_dataset_doc,
    find_model_doc,
    infer_target_column,
    load_dataset,
    load_model,
)
from app.services.ml_service import compute_classification_metrics
from app.services.report_service import build_model_report_pdf
from app.services.shap_service import run_shap_analysis
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


def _json_safe(value):
    return json.loads(json.dumps(value, default=str))


def _strip_mongo_meta(doc):
    if not isinstance(doc, dict):
        return {}
    copy = dict(doc)
    copy.pop("_id", None)
    return copy


@router.post("/generate")
async def generate_report(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
    try:
        db = get_db()
        metrics = await db.metrics.find_one(
            {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
            sort=[("created_at", -1)],
        )
        shap = await db.shap_reports.find_one(
            {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
            sort=[("created_at", -1)],
        )
        governance = await db.governance_reports.find_one(
            {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
            sort=[("created_at", -1)],
        )
        drift = await db.drift_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])

        if not metrics:
            snapshot = _json_safe(
                {
                    "model_id": model_id,
                    "dataset_id": dataset_id,
                    "metrics": {},
                    "shap_summary": (shap or {}).get("summary", {}),
                    "governance": _strip_mongo_meta(governance or {}),
                    "drift": _strip_mongo_meta(drift or {}),
                    "warning": "Metrics report missing; generated partial governance snapshot.",
                }
            )
            checksum = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode("utf-8")).hexdigest()
            doc = {
                "tenant_id": user["tenant_id"],
                "model_id": model_id,
                "dataset_id": dataset_id,
                "snapshot": snapshot,
                "trust_score": (governance or {}).get("trust_score"),
                "checksum": checksum,
                "generated_by": user["uid"],
                "generated_at": utc_now(),
                "fallback": True,
            }
            result = await db.reports.insert_one(doc)
            await write_audit(
                db,
                user["tenant_id"],
                user["uid"],
                "report_generate_partial",
                "report",
                str(result.inserted_id),
                {"model_id": model_id, "dataset_id": dataset_id},
            )
            return {"success": True, "data": _json_safe({"id": str(result.inserted_id), "checksum": checksum, **doc})}

        snapshot = _json_safe(
            {
                "model_id": model_id,
                "dataset_id": dataset_id,
                "metrics": (metrics or {}).get("metrics", {}),
                "shap_summary": (shap or {}).get("summary", {}),
                "governance": _strip_mongo_meta(governance or {}),
                "drift": _strip_mongo_meta(drift or {}),
            }
        )
        checksum = hashlib.sha256(json.dumps(snapshot, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        doc = {
            "tenant_id": user["tenant_id"],
            "model_id": model_id,
            "dataset_id": dataset_id,
            "snapshot": snapshot,
            "trust_score": (governance or {}).get("trust_score"),
            "checksum": checksum,
            "generated_by": user["uid"],
            "generated_at": utc_now(),
        }
        result = await db.reports.insert_one(doc)
        await write_audit(
            db,
            user["tenant_id"],
            user["uid"],
            "report_generate",
            "report",
            str(result.inserted_id),
            {"model_id": model_id, "dataset_id": dataset_id},
        )

        return {"success": True, "data": _json_safe({"id": str(result.inserted_id), "checksum": checksum, **doc})}
    except Exception as exc:
        fallback_snapshot = _json_safe(
            {
                "model_id": model_id,
                "dataset_id": dataset_id,
                "metrics": {},
                "shap_summary": {},
                "governance": {},
                "drift": {},
                "warning": f"Report fallback used: {exc}",
            }
        )
        checksum = hashlib.sha256(json.dumps(fallback_snapshot, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        return {
            "success": True,
            "data": {
                "id": "fallback",
                "checksum": checksum,
                "tenant_id": user.get("tenant_id"),
                "model_id": model_id,
                "dataset_id": dataset_id,
                "snapshot": fallback_snapshot,
                "trust_score": None,
                "generated_by": user.get("uid"),
                "generated_at": utc_now().isoformat(),
                "fallback": True,
            },
        }


@router.get("")
async def list_reports(user=Depends(verify_token)):
    try:
        db = get_db()
        rows = await db.reports.find({"tenant_id": user["tenant_id"]}).sort("generated_at", -1).to_list(100)
        for row in rows:
            row["id"] = str(row.pop("_id"))
        return {"success": True, "data": _json_safe(rows)}
    except Exception as exc:
        return {
            "success": True,
            "data": [],
            "warning": f"Reports fallback: {exc}",
        }


@router.get("/download")
async def download_report(model_id: str = Query(...), dataset_id: str = Query(...), user=Depends(verify_token)):
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

    metrics_doc = await db.metrics.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    shap_doc = await db.shap_reports.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    governance_doc = await db.governance_reports.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )

    missing = int(df.isna().sum().sum())
    duplicates = int(df.duplicated().sum())
    numerical = int(df.select_dtypes(include=["number"]).shape[1])
    categorical = int(df.shape[1] - numerical)
    quality_score = round(max(0.0, 100.0 - ((missing / max(1, df.shape[0] * df.shape[1])) * 100.0) - ((duplicates / max(1, df.shape[0])) * 20.0)), 2)

    metrics = (metrics_doc or {}).get("metrics", {})
    if not metrics and target_column and target_column in df.columns:
        x = align_features(model, df.drop(columns=[target_column]))
        if not x.empty:
            try:
                y_true = df[target_column]
                y_pred = model.predict(x)
                y_prob = model.predict_proba(x) if hasattr(model, "predict_proba") else None
                metrics = compute_classification_metrics(y_true, y_pred, y_prob)
                metrics["target_column"] = target_column
            except Exception:
                metrics = {}

    shap_summary = (shap_doc or {}).get("summary")
    if not shap_summary:
        try:
            shap_summary = run_shap_analysis(
                model_id=model_id,
                dataset_id=dataset_id,
                model_doc=model_doc,
                dataset_doc=dataset_doc,
                row_index=0,
                max_rows=200,
            )
        except Exception:
            shap_summary = {}

    governance_summary = governance_doc or {}
    if not governance_summary:
        risk = "low" if quality_score >= 80 else ("medium" if quality_score >= 60 else "high")
        governance_summary = {
            "dataset_size": int(df.shape[0]),
            "model_type": model.__class__.__name__,
            "risk_classification": risk,
        }

    f1 = float(metrics.get("f1_score", metrics.get("f1", 0.0)) or 0.0)
    trust = float(governance_summary.get("trust_score", 0.0) or 0.0)
    suggestions = [
        "Increase training data volume and diversity if dataset has low row count.",
        "Tune model hyperparameters with cross-validation and compare alternatives.",
        "Monitor top SHAP features and drop consistently low-impact features.",
        "Address any detected missing or duplicate data before retraining.",
        "Re-run governance analysis after each model update.",
    ]
    model_quality_score = round((quality_score * 0.35) + (f1 * 100.0 * 0.4) + (trust * 0.25), 2)

    report_data = {
        "model": {
            "name": model_doc.get("name"),
            "type": model.__class__.__name__,
            "algorithm": model.__class__.__name__,
            "target_column": target_column,
            "features_count": int(max(df.shape[1] - 1, 0)),
        },
        "dataset": {
            "stats": {
                "rows": int(df.shape[0]),
                "columns": int(df.shape[1]),
                "missing_values": missing,
                "duplicate_rows": duplicates,
                "numerical_count": numerical,
                "categorical_count": categorical,
            },
            "quality_score": quality_score,
        },
        "metrics": metrics,
        "shap": shap_summary or {},
        "governance": governance_summary,
        "ai": {
            "suggestions": suggestions,
            "model_quality_score": model_quality_score,
        },
    }
    pdf_bytes = build_model_report_pdf(report_data)
    filename = f"model_report_{model_id}.pdf"

    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "report_download",
        "report",
        filename,
        {"model_id": model_id, "dataset_id": dataset_id, "bytes": len(pdf_bytes)},
    )

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
