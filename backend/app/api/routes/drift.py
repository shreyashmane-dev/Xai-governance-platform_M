import numpy as np
import pandas as pd
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


def _oid(value: str, field_name: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return ObjectId(value)


def _read_dataset(path: str, label: str) -> pd.DataFrame:
    try:
        return pd.read_csv(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"{label} dataset file not found on disk") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read {label} dataset: {exc}") from exc


def psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    expected = expected.replace([np.inf, -np.inf], np.nan).dropna()
    actual = actual.replace([np.inf, -np.inf], np.nan).dropna()
    if expected.empty or actual.empty:
        return 0.0

    cuts = np.percentile(expected, np.linspace(0, 100, bins + 1))
    cuts = np.unique(cuts)
    if len(cuts) < 3:
        return 0.0

    expected_dist = np.histogram(expected, cuts)[0] / max(len(expected), 1)
    actual_dist = np.histogram(actual, cuts)[0] / max(len(actual), 1)
    expected_dist = np.where(expected_dist == 0, 1e-6, expected_dist)
    actual_dist = np.where(actual_dist == 0, 1e-6, actual_dist)
    return float(np.sum((actual_dist - expected_dist) * np.log(actual_dist / expected_dist)))


def js_divergence(expected: pd.Series, actual: pd.Series) -> float:
    p = expected.fillna("NA").astype(str).value_counts(normalize=True)
    q = actual.fillna("NA").astype(str).value_counts(normalize=True)
    idx = p.index.union(q.index)
    p = p.reindex(idx, fill_value=1e-6).to_numpy(dtype=float)
    q = q.reindex(idx, fill_value=1e-6).to_numpy(dtype=float)
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)
    kl_pm = np.sum(p * np.log(p / m))
    kl_qm = np.sum(q * np.log(q / m))
    return float(0.5 * (kl_pm + kl_qm))


def _safe_mean(series: pd.Series) -> float:
    arr = pd.to_numeric(series, errors="coerce").to_numpy(dtype=float)
    if arr.size == 0 or np.isnan(arr).all():
        return 0.0
    return float(np.nanmean(arr))


def _finite(value: float, default: float = 0.0) -> float:
    try:
        v = float(value)
    except Exception:
        return float(default)
    if not np.isfinite(v):
        return float(default)
    return v


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


@router.post("/analyze")
async def analyze_drift(baseline_dataset_id: str = Query(...), current_dataset_id: str = Query(...), user=Depends(verify_token)):
    try:
        db = get_db()
        baseline = await db.datasets.find_one({"_id": _oid(baseline_dataset_id, "baseline_dataset_id"), "tenant_id": user["tenant_id"]})
        current = await db.datasets.find_one({"_id": _oid(current_dataset_id, "current_dataset_id"), "tenant_id": user["tenant_id"]})
        if not baseline or not current:
            raise HTTPException(status_code=404, detail="Baseline or current dataset not found")

        bdf = _read_dataset(baseline["storage_path"], "Baseline")
        cdf = _read_dataset(current["storage_path"], "Current")
        shared_cols = [c for c in bdf.columns if c in cdf.columns]
        numeric_cols = [
            c
            for c in shared_cols
            if pd.api.types.is_numeric_dtype(pd.to_numeric(bdf[c], errors="coerce"))
            and pd.api.types.is_numeric_dtype(pd.to_numeric(cdf[c], errors="coerce"))
        ]
        categorical_cols = [c for c in shared_cols if c not in numeric_cols]
        if not shared_cols:
            empty_report = {
                "tenant_id": user["tenant_id"],
                "baseline_dataset_id": baseline_dataset_id,
                "current_dataset_id": current_dataset_id,
                "features": [],
                "alert_count": 1,
                "alerts": [{"feature": "__schema__", "reason": "No shared columns between datasets"}],
                "advanced": {
                    "numeric_feature_count": 0,
                    "categorical_feature_count": 0,
                    "avg_psi": 0.0,
                    "avg_js_divergence": 0.0,
                    "distribution_shift_score": 100.0,
                    "stability_score": 0.0,
                    "severity": "high",
                },
                "created_at": utc_now(),
            }
            await db.drift_reports.insert_one(empty_report)
            await write_audit(
                db,
                user["tenant_id"],
                user["uid"],
                "drift_analyze",
                "dataset",
                current_dataset_id,
                {"baseline_dataset_id": baseline_dataset_id, "note": "no_shared_columns"},
            )
            return JSONResponse(content=_plain({"success": True, "data": empty_report}))

        features = []
        alerts = []
        for col in numeric_cols[:50]:
            bcol = pd.to_numeric(bdf[col], errors="coerce")
            ccol = pd.to_numeric(cdf[col], errors="coerce")
            score = _finite(psi(bcol, ccol))
            status = "alert" if score > 0.2 else "ok"
            if status == "alert":
                alerts.append({"feature": col, "psi": round(score, 4)})
            features.append(
                {
                    "feature": col,
                    "psi": round(score, 4),
                    "status": status,
                    "baseline_mean": _finite(_safe_mean(bcol)),
                    "current_mean": _finite(_safe_mean(ccol)),
                }
            )

        for col in categorical_cols[:25]:
            score = _finite(js_divergence(bdf[col], cdf[col]))
            status = "alert" if score > 0.1 else "ok"
            if status == "alert":
                alerts.append({"feature": col, "js_divergence": round(score, 4)})
            features.append(
                {
                    "feature": col,
                    "js_divergence": round(score, 4),
                    "status": status,
                    "feature_type": "categorical",
                }
            )

        report = {
            "tenant_id": user["tenant_id"],
            "baseline_dataset_id": baseline_dataset_id,
            "current_dataset_id": current_dataset_id,
            "features": features,
            "alert_count": len(alerts),
            "alerts": alerts,
            "advanced": {
                "numeric_feature_count": len(numeric_cols),
                "categorical_feature_count": len(categorical_cols),
                "avg_psi": round(_finite(np.mean([f.get("psi", 0.0) for f in features if "psi" in f])), 4),
                "avg_js_divergence": round(_finite(np.mean([f.get("js_divergence", 0.0) for f in features if "js_divergence" in f])), 4),
            },
            "created_at": utc_now(),
        }
        shift_score = _finite((report["advanced"]["avg_psi"] * 70.0) + (report["advanced"]["avg_js_divergence"] * 30.0))
        report["advanced"]["distribution_shift_score"] = round(min(100.0, max(0.0, shift_score * 100.0)), 2)
        report["advanced"]["stability_score"] = round(max(0.0, 100.0 - report["advanced"]["distribution_shift_score"]), 2)
        report["advanced"]["severity"] = (
            "high"
            if report["advanced"]["distribution_shift_score"] >= 60
            else "medium"
            if report["advanced"]["distribution_shift_score"] >= 30
            else "low"
        )
        report = _plain(report)
        await db.drift_reports.insert_one(report)
        await write_audit(
            db,
            user["tenant_id"],
            user["uid"],
            "drift_analyze",
            "dataset",
            current_dataset_id,
            {"baseline_dataset_id": baseline_dataset_id},
        )
        return JSONResponse(content=_plain({"success": True, "data": report}))
    except HTTPException:
        fallback = {
            "tenant_id": user.get("tenant_id"),
            "baseline_dataset_id": baseline_dataset_id,
            "current_dataset_id": current_dataset_id,
            "features": [],
            "alert_count": 1,
            "alerts": [{"feature": "__drift__", "reason": "Drift fallback: incompatible dataset artifacts"}],
            "advanced": {
                "numeric_feature_count": 0,
                "categorical_feature_count": 0,
                "avg_psi": 0.0,
                "avg_js_divergence": 0.0,
                "distribution_shift_score": 100.0,
                "stability_score": 0.0,
                "severity": "high",
            },
            "created_at": utc_now(),
            "fallback": True,
        }
        return JSONResponse(content=_plain({"success": True, "data": fallback}))
    except Exception as exc:
        fallback = {
            "tenant_id": user.get("tenant_id"),
            "baseline_dataset_id": baseline_dataset_id,
            "current_dataset_id": current_dataset_id,
            "features": [],
            "alert_count": 1,
            "alerts": [{"feature": "__drift__", "reason": f"Drift fallback activated: {exc}"}],
            "advanced": {
                "numeric_feature_count": 0,
                "categorical_feature_count": 0,
                "avg_psi": 0.0,
                "avg_js_divergence": 0.0,
                "distribution_shift_score": 100.0,
                "stability_score": 0.0,
                "severity": "high",
            },
            "created_at": utc_now(),
            "fallback": True,
        }
        return JSONResponse(content=_plain({"success": True, "data": fallback}))
