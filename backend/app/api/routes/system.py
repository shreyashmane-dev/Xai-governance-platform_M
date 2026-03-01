from datetime import datetime, timezone
import os
import shutil

from fastapi import APIRouter, Depends
from fastapi.routing import APIRoute
import psutil

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.audit import write_audit

router = APIRouter()
BOOTED_AT = datetime.now(timezone.utc)


@router.get("/metrics")
def get_metrics():
    cpu = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    try:
        disk = psutil.disk_usage("C:\\")
    except Exception:
        disk = psutil.disk_usage(".")

    return {
        "cpu_usage": cpu,
        "memory_usage": memory.percent,
        "disk_usage": disk.percent,
    }


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
                "storage_backend": settings.storage_backend,
                "strict_feature_compatibility": settings.strict_feature_compatibility,
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


@router.get("/functions")
async def list_functions(user=Depends(verify_token)):
    from app.api.router import api_router

    functions = []
    for route in api_router.routes:
        if not isinstance(route, APIRoute):
            continue
        methods = sorted(m for m in (route.methods or set()) if m not in {"HEAD", "OPTIONS"})
        if not methods:
            continue
        for method in methods:
            functions.append(
                {
                    "id": f"{method}:{route.path}",
                    "method": method,
                    "path": f"/api{route.path}",
                    "name": route.name,
                    "group": (route.tags or ["general"])[0],
                }
            )

    functions.sort(key=lambda row: (row["path"], row["method"]))
    return {
        "success": True,
        "data": {
            "functions": functions,
            "total": len(functions),
        },
    }


@router.get("/self-test")
async def self_test(user=Depends(verify_token)):
    from app.api.router import api_router

    db = get_db()
    checks = []

    try:
        await db.command("ping")
        checks.append({"name": "mongodb_ping", "ok": True})
    except Exception as exc:
        checks.append({"name": "mongodb_ping", "ok": False, "detail": str(exc)})

    route_signatures = set()
    for route in api_router.routes:
        if not isinstance(route, APIRoute):
            continue
        methods = [m for m in (route.methods or set()) if m not in {"HEAD", "OPTIONS"}]
        for method in methods:
            route_signatures.add((method, f"/api{route.path}"))

    expected = [
        ("GET", "/api/system/status"),
        ("GET", "/api/system/functions"),
        ("POST", "/api/models/upload"),
        ("POST", "/api/datasets/upload"),
        ("POST", "/api/analytics/metrics"),
        ("POST", "/api/chat"),
    ]
    for method, path in expected:
        checks.append(
            {
                "name": f"route_{method}_{path}",
                "ok": (method, path) in route_signatures,
            }
        )

    checks.append({"name": "route_count", "ok": len(route_signatures) > 0, "value": len(route_signatures)})
    all_ok = all(item.get("ok") for item in checks)
    return {
        "success": True,
        "data": {
            "ok": all_ok,
            "tenant_id": user["tenant_id"],
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
        },
    }
@router.get("/storage")
async def list_local_storage(user=Depends(verify_token)):
    """List local data files and their sizes."""
    base_path = "data"
    db_name = settings.mongo_db_name
    db_path = os.path.join(base_path, db_name)
    
    if not os.path.exists(db_path):
        return {"success": True, "data": []}
    
    files = []
    for filename in os.listdir(db_path):
        if filename.endswith(".json"):
            file_path = os.path.join(db_path, filename)
            stats = os.stat(file_path)
            files.append({
                "collection": filename[:-5],
                "size_bytes": stats.st_size,
                "last_modified": datetime.fromtimestamp(stats.st_mtime, timezone.utc).isoformat()
            })
    
    return {"success": True, "data": files}


@router.get("/resources")
async def system_resources(user=Depends(verify_token)):
    """Get basic system resource usage."""
    try:
        import psutil
    except ImportError:
        disk = shutil.disk_usage(".")
        return {
            "success": True,
            "data": {
                "cpu_percent": 0.0,
                "memory": None,
                "disk": {
                    "total": disk.total,
                    "free": disk.free,
                    "used": disk.used,
                    "percent": round((disk.used / max(disk.total, 1)) * 100.0, 2),
                },
                "warning": "psutil is not installed",
            },
        }
    
    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('.')
    
    return {
        "success": True,
        "data": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "free": disk.free,
                "used": disk.used,
                "percent": disk.percent
            }
        }
    }


@router.delete("/storage/{collection}")
async def delete_local_collection(collection: str, user=Depends(verify_token)):
    """Delete a specific local collection file."""
    base_path = "data"
    db_name = settings.mongo_db_name
    file_path = os.path.join(base_path, db_name, f"{collection}.json")
    
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"success": True, "message": f"Collection '{collection}' deleted"}
        except OSError as exc:
            return {"success": False, "detail": str(exc)}
            
    return {"success": False, "detail": "Collection not found"}
