import hashlib
import json

from fastapi import APIRouter, Depends, Query

from app.core.security import verify_token
from app.db.mongo import get_db
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
