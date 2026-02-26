import pandas as pd
import os
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.audit import write_audit
from app.utils.files import safe_storage_path
from app.utils.time_utils import utc_now

router = APIRouter()


@router.post("/upload")
async def upload_dataset(
    name: str = Form(...),
    version: str = Form("v1"),
    file: UploadFile = File(...),
    user=Depends(verify_token),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    raw = await file.read()
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    path = safe_storage_path(settings.upload_dir, file.filename)
    with open(path, "wb") as out:
        out.write(raw)

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")

    preview = df.head(10).fillna("").to_dict(orient="records")
    profile = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "null_cells": int(df.isna().sum().sum()),
    }
    db = get_db()
    doc = {
        "tenant_id": user["tenant_id"],
        "owner_uid": user["uid"],
        "name": name.strip(),
        "version": version,
        "file_name": file.filename,
        "storage_path": path,
        "row_count": int(df.shape[0]),
        "column_count": int(df.shape[1]),
        "columns": list(df.columns),
        "profile": profile,
        "created_at": utc_now(),
    }
    from pymongo.errors import DuplicateKeyError
    try:
        result = await db.datasets.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail=f"A dataset named '{name.strip()}' with version '{version}' already exists."
        )

    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "dataset_upload",
        "dataset",
        str(result.inserted_id),
        {"name": name, "version": version},
    )

    return {"success": True, "data": {"id": str(result.inserted_id), "preview": preview, "profile": profile}}


@router.get("")
async def list_datasets(user=Depends(verify_token)):
    db = get_db()
    rows = await db.datasets.find({"tenant_id": user["tenant_id"]}).sort("created_at", -1).to_list(200)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return {"success": True, "data": rows}


@router.get("/{dataset_id}/preview")
async def dataset_preview(dataset_id: str, limit: int = 10, user=Depends(verify_token)):
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(status_code=400, detail="Invalid dataset id")

    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Dataset not found")

    storage_path = doc.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(
            status_code=400, 
            detail="Dataset file missing on server. Note: cloud storage is ephemeral. Please re-upload the dataset."
        )

    try:
        df = pd.read_csv(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}") from exc

    preview = df.head(max(1, min(limit, 50))).fillna("").to_dict(orient="records")
    return {
        "success": True,
        "data": {
            "dataset_id": dataset_id,
            "name": doc.get("name"),
            "row_count": int(df.shape[0]),
            "column_count": int(df.shape[1]),
            "columns": list(df.columns),
            "preview": preview,
        },
    }


@router.get("/{dataset_id}/schema")
async def dataset_schema(dataset_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(status_code=400, detail="Invalid dataset id")

    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Dataset not found")

    storage_path = doc.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(
            status_code=400, 
            detail="Dataset file missing on server. Please re-upload."
        )

    try:
        df = pd.read_csv(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}") from exc

    columns = []
    for col in df.columns:
        s = df[col]
        dtype = "numeric" if pd.api.types.is_numeric_dtype(s) else "categorical"
        missing = int(s.isna().sum())
        unique = int(s.nunique(dropna=True))
        columns.append(
            {
                "name": col,
                "type": dtype,
                "dtype": str(s.dtype),
                "missing_count": missing,
                "missing_ratio": round(float(missing / max(len(df), 1)), 4),
                "unique_count": unique,
            }
        )

    return {
        "success": True,
        "data": {
            "dataset_id": dataset_id,
            "name": doc.get("name"),
            "row_count": int(df.shape[0]),
            "column_count": int(df.shape[1]),
            "columns": columns,
        },
    }


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, user=Depends(verify_token)):
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(status_code=400, detail="Invalid dataset id")

    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Dataset not found")

    storage_path = doc.get("storage_path")
    await db.datasets.delete_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    await db.metrics.delete_many({"tenant_id": user["tenant_id"], "dataset_id": dataset_id})
    await db.shap_reports.delete_many({"tenant_id": user["tenant_id"], "dataset_id": dataset_id})
    await db.governance_reports.delete_many({"tenant_id": user["tenant_id"], "dataset_id": dataset_id})
    await db.reports.delete_many({"tenant_id": user["tenant_id"], "dataset_id": dataset_id})
    await db.drift_reports.delete_many(
        {
            "tenant_id": user["tenant_id"],
            "$or": [{"baseline_dataset_id": dataset_id}, {"current_dataset_id": dataset_id}],
        }
    )

    if storage_path and os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except OSError:
            pass

    await write_audit(db, user["tenant_id"], user["uid"], "dataset_delete", "dataset", dataset_id, {"name": doc.get("name")})
    return {"success": True, "data": {"deleted_dataset_id": dataset_id}}
