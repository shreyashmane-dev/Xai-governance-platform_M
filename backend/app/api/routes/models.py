import pickle
import os

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.services.ml_service import checksum_bytes, validate_model_bytes
from app.utils.audit import write_audit
from app.utils.files import safe_storage_path
from app.utils.time_utils import utc_now

router = APIRouter()


@router.post("/upload")
async def upload_model(
    name: str = Form(...),
    version: str = Form(""),
    target_column: str = Form("target"),
    model_owner: str = Form(""),
    department: str = Form(""),
    intended_use: str = Form(""),
    risk_category: str = Form("medium"),
    file: UploadFile = File(...),
    user=Depends(verify_token),
):
    if not file.filename.lower().endswith(".pkl"):
        raise HTTPException(status_code=400, detail="Only .pkl files are allowed")

    raw = await file.read()
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    ok, model_type = validate_model_bytes(raw)
    if not ok:
        raise HTTPException(status_code=400, detail=model_type)

    path = safe_storage_path(settings.upload_dir, file.filename)
    with open(path, "wb") as out:
        out.write(raw)

    schema = []
    try:
        loaded = pickle.loads(raw)
        schema = list(getattr(loaded, "feature_names_in_", []) or [])
    except Exception:
        schema = []

    db = get_db()
    if not version.strip():
        existing = await db.models.count_documents({"tenant_id": user["tenant_id"], "name": name.strip()})
        version = f"v{existing + 1}"

    doc = {
        "tenant_id": user["tenant_id"],
        "owner_uid": user["uid"],
        "name": name.strip(),
        "version": version,
        "target_column": target_column,
        "metadata": {
            "model_owner": model_owner.strip(),
            "department": department.strip(),
            "intended_use": intended_use.strip(),
            "risk_category": (risk_category or "medium").strip().lower(),
        },
        "status": "active",
        "file_name": file.filename,
        "storage_path": path,
        "model_type": model_type,
        "feature_schema": schema,
        "checksum": checksum_bytes(raw),
        "created_at": utc_now(),
    }
    from pymongo.errors import DuplicateKeyError
    try:
        result = await db.models.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=400, 
            detail=f"A model named '{name.strip()}' with version '{version}' already exists."
        )

    await write_audit(db, user["tenant_id"], user["uid"], "model_upload", "model", str(result.inserted_id), {"name": name, "version": version})

    return {"success": True, "data": {"id": str(result.inserted_id), "model_type": model_type, "version": version}}


@router.get("")
async def list_models(user=Depends(verify_token)):
    db = get_db()
    rows = await db.models.find({"tenant_id": user["tenant_id"]}).sort("created_at", -1).to_list(200)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return {"success": True, "data": rows}


@router.delete("/{model_id}")
async def delete_model(model_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(model_id):
        raise HTTPException(status_code=400, detail="Invalid model id")

    db = get_db()
    doc = await db.models.find_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    storage_path = doc.get("storage_path")
    await db.models.delete_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    await db.metrics.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.shap_reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.governance_reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.chat_history.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})

    if storage_path and os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except OSError:
            pass

    await write_audit(db, user["tenant_id"], user["uid"], "model_delete", "model", model_id, {"name": doc.get("name")})
    return {"success": True, "data": {"deleted_model_id": model_id}}
