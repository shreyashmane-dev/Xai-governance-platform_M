from datetime import datetime, timezone
import os

from fastapi import APIRouter, Depends

from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.audit import write_audit

router = APIRouter()
BOOTED_AT = datetime.now(timezone.utc)


@router.get("/status")
async def system_status(user=Depends(verify_token)):
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        uptime_seconds = int((now - BOOTED_AT).total_seconds())

        model_count = await db.models.count_documents({"tenant_id": user["tenant_id"]})
        dataset_count = await db.datasets.count_documents({"tenant_id": user["tenant_id"]})
        report_count = await db.reports.count_documents({"tenant_id": user["tenant_id"]})

        latest_governance = await db.governance_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])
        latest_drift = await db.drift_reports.find_one({"tenant_id": user["tenant_id"]}, sort=[("created_at", -1)])

        return {
            "success": True,
            "data": {
                "ok": True,
                "system_time": now.isoformat(),
                "uptime_seconds": uptime_seconds,
                "models": model_count,
                "datasets": dataset_count,
                "reports": report_count,
                "trust_score": (latest_governance or {}).get("trust_score"),
                "drift_alert_count": (latest_drift or {}).get("alert_count", 0),
            },
        }
    except Exception as exc:
        now = datetime.now(timezone.utc)
        return {
            "success": True,
            "data": {
                "ok": False,
                "system_time": now.isoformat(),
                "uptime_seconds": int((now - BOOTED_AT).total_seconds()),
                "models": 0,
                "datasets": 0,
                "reports": 0,
                "trust_score": None,
                "drift_alert_count": 0,
                "warning": f"System status fallback: {exc}",
            },
        }


@router.delete("/reset")
async def reset_tenant_data(user=Depends(verify_token)):
    db = get_db()
    tenant_id = user["tenant_id"]

    model_docs = await db.models.find({"tenant_id": tenant_id}).to_list(10000)
    dataset_docs = await db.datasets.find({"tenant_id": tenant_id}).to_list(10000)
    file_paths = [d.get("storage_path") for d in model_docs + dataset_docs if d.get("storage_path")]

    collections = [
        db.models,
        db.datasets,
        db.metrics,
        db.shap_reports,
        db.governance_reports,
        db.drift_reports,
        db.reports,
        db.chat_history,
        db.audit_logs,
    ]
    for col in collections:
        await col.delete_many({"tenant_id": tenant_id})

    for path in file_paths:
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass

    await write_audit(db, tenant_id, user["uid"], "tenant_reset", "tenant", tenant_id, {"removed_files": len(file_paths)})
    return {"success": True, "data": {"tenant_id": tenant_id, "removed_files": len(file_paths)}}


@router.get("/audit-log")
async def audit_log(limit: int = 100, action: str = "", entity_type: str = "", user=Depends(verify_token)):
    try:
        db = get_db()
        query = {"tenant_id": user["tenant_id"]}
        if action:
            query["action"] = action
        if entity_type:
            query["resource_type"] = entity_type

        rows = await db.audit_logs.find(query).sort("created_at", -1).to_list(max(1, min(limit, 500)))
        for row in rows:
            row["id"] = str(row.pop("_id"))
        return {"success": True, "data": rows}
    except Exception as exc:
        return {
            "success": True,
            "data": [],
            "warning": f"Audit log fallback: {exc}",
        }
