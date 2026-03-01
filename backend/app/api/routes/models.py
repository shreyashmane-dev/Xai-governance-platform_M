import pickle
import os
import logging
import pandas as pd

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.services.ml_service import checksum_bytes, validate_model_bytes
from app.utils.compatibility import check_feature_compatibility
from app.utils.audit import write_audit
from app.utils.storage import ArtifactStorageError, delete_artifact, persist_artifact, resolve_artifact_path
from app.utils.time_utils import utc_now

router = APIRouter()
LOGGER = logging.getLogger(__name__)


@router.post("/upload")
async def upload_model(
    request: Request,
    name: str = Form(None),
    modelName: str = Form(None),
    description: str = Form(""),
    version: str = Form(""),
    target_column: str = Form("target"),
    targetColumn: str = Form(None),
    model_owner: str = Form(""),
    department: str = Form(""),
    intended_use: str = Form(""),
    risk_category: str = Form("medium"),
    file: UploadFile = File(None),
    model: UploadFile = File(None),
    user=Depends(verify_token),
):
    LOGGER.info("Model upload attempt by user=%s", user.get("uid"))
    
    # Relaxed content-type check
    content_type = request.headers.get("content-type", "").lower()
    if "multipart" not in content_type:
        LOGGER.warning("Invalid content-type: %s", content_type)
        # We'll still try to proceed if FastAPI managed to parse it

    upload_file = file or model
    if not upload_file:
        LOGGER.error("No file found in 'file' or 'model' fields")
        raise HTTPException(status_code=400, detail="No file uploaded. Please select a .pkl file.")

    raw_name = (name or modelName or "").strip()
    resolved_name = raw_name or os.path.splitext(upload_file.filename or "model")[0]
    
    file_name = upload_file.filename or "model.pkl"
    if not file_name.lower().endswith((".pkl", ".pickle")):
        LOGGER.warning("Invalid file extension: %s", file_name)
        raise HTTPException(status_code=400, detail="Only .pkl/.pickle files are allowed")

    resolved_target = (targetColumn or target_column or "target").strip()

    try:
        raw = await upload_file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        ok, model_type = validate_model_bytes(raw)
        if not ok:
            raise HTTPException(status_code=400, detail=model_type)

        storage_meta = persist_artifact(raw, file_name, "models")

        schema = []
        try:
            loaded = pickle.loads(raw)
            schema = list(getattr(loaded, "feature_names_in_", []) or [])
        except Exception:
            schema = []

        db = get_db()
        if not version.strip():
            existing = await db.models.count_documents({"tenant_id": user["tenant_id"], "name": resolved_name})
            version = f"v{existing + 1}"

        doc = {
            "tenant_id": user["tenant_id"],
            "owner_uid": user["uid"],
            "name": resolved_name,
            "version": version,
            "description": description.strip(),
            "target_column": resolved_target,
            "metadata": {
                "model_owner": model_owner.strip(),
                "department": department.strip(),
                "intended_use": intended_use.strip(),
                "risk_category": (risk_category or "medium").strip().lower(),
            },
            "status": "active",
            "file_name": file_name,
            "storage_path": storage_meta["storage_path"],
            "storage_backend": storage_meta["storage_backend"],
            "storage_key": storage_meta["storage_key"],
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
                detail=f"A model named '{resolved_name}' with version '{version}' already exists."
            )

        await write_audit(
            db,
            user["tenant_id"],
            user["uid"],
            "model_upload",
            "model",
            str(result.inserted_id),
            {"name": resolved_name, "version": version},
        )

        return {
            "success": True,
            "data": {
                "id": str(result.inserted_id),
                "model_type": model_type,
                "version": version,
                "modelName": resolved_name,
                "description": description.strip(),
                "filePath": storage_meta["storage_path"],
                "storageBackend": storage_meta["storage_backend"],
                "scan": {
                    "modelType": model_type,
                    "featureCount": len(schema),
                    "checksum": doc["checksum"],
                },
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Model upload failed for tenant=%s", user.get("tenant_id"), exc_info=exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("")
async def list_models(user=Depends(verify_token)):
    db = get_db()
    rows = await db.models.find({"tenant_id": user["tenant_id"]}).sort("created_at", -1).to_list(200)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return {"success": True, "data": rows}


@router.get("/{model_id}/result-summary")
async def get_model_result_summary(model_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(model_id):
        raise HTTPException(status_code=400, detail="Invalid model id")

    db = get_db()
    model_doc = await db.models.find_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    if not model_doc:
        raise HTTPException(status_code=404, detail="Model not found")

    metric_doc = await db.metrics.find_one(
        {"tenant_id": user["tenant_id"], "model_id": model_id},
        sort=[("created_at", -1)],
    )
    metrics = (metric_doc or {}).get("metrics", {})
    return {
        "success": True,
        "data": {
            "modelName": model_doc.get("name"),
            "accuracy": metrics.get("accuracy"),
            "precision": metrics.get("precision"),
            "recall": metrics.get("recall"),
            "f1Score": metrics.get("f1"),
        },
    }


@router.get("/{model_id}/compatibility/{dataset_id}")
async def get_model_dataset_compatibility(model_id: str, dataset_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(model_id) or not ObjectId.is_valid(dataset_id):
        raise HTTPException(status_code=400, detail="Invalid model_id or dataset_id")

    db = get_db()
    model_doc = await db.models.find_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    dataset_doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    if not model_doc or not dataset_doc:
        raise HTTPException(status_code=404, detail="Model or dataset not found")

    try:
        model_path = resolve_artifact_path(model_doc, "model")
        dataset_path = resolve_artifact_path(dataset_doc, "dataset")
        
        # Try loading model with pickle/joblib
        model_obj = None
        with open(model_path, "rb") as src:
            try:
                model_obj = pickle.load(src)
            except Exception:
                try:
                    import joblib
                    model_obj = joblib.load(src)
                except Exception:
                    pass
        
        df = pd.read_csv(dataset_path)
        target = model_doc.get("target_column", "target")
        compatibility = check_feature_compatibility(model_doc, df, target, model=model_obj)
        
        return {
            "success": True,
            "data": {
                "model_id": model_id,
                "dataset_id": dataset_id,
                "compatible": compatibility.compatible,
                "strict_mode": settings.strict_feature_compatibility,
                "expected_feature_count": len(compatibility.expected_features),
                "dataset_feature_count": len(compatibility.dataset_features),
                "missing_features": compatibility.missing_features,
                "extra_features": compatibility.extra_features,
            },
        }
    except (ArtifactStorageError, Exception) as exc:
        LOGGER.warning("Compatibility check fallback due to missing files: %s", exc)
        # Fallback to metadata-only comparison if possible
        expected = model_doc.get("feature_schema") or []
        found = dataset_doc.get("columns") or []
        
        missing = [f for f in expected if f not in found]
        compatible = len(missing) == 0
        
        return {
            "success": True,
            "data": {
                "model_id": model_id,
                "dataset_id": dataset_id,
                "compatible": compatible,
                "strict_mode": True,
                "expected_feature_count": len(expected),
                "dataset_feature_count": len(found),
                "missing_features": missing,
                "extra_features": [],
                "note": "Validated via metadata (original files missing/unavailable)"
            },
        }


@router.delete("/{model_id}")
async def delete_model(model_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(model_id):
        raise HTTPException(status_code=400, detail="Invalid model id")

    db = get_db()
    doc = await db.models.find_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    await db.models.delete_one({"_id": ObjectId(model_id), "tenant_id": user["tenant_id"]})
    await db.metrics.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.shap_reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.governance_reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.reports.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})
    await db.chat_history.delete_many({"tenant_id": user["tenant_id"], "model_id": model_id})

    delete_artifact(doc)

    await write_audit(db, user["tenant_id"], user["uid"], "model_delete", "model", model_id, {"name": doc.get("name")})
    return {"success": True, "data": {"deleted_model_id": model_id}}
