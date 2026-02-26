import pandas as pd
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.utils.audit import write_audit
from app.utils.storage import ArtifactStorageError, delete_artifact, persist_artifact, resolve_artifact_path
from app.utils.time_utils import utc_now

router = APIRouter()
LOGGER = logging.getLogger(__name__)


def _safe_limit(value: str | None, default: int = 10, min_value: int = 1, max_value: int = 50) -> int:
    try:
        parsed = int(value) if value is not None else default
    except (TypeError, ValueError):
        return default
    return max(min_value, min(parsed, max_value))


@router.post("/upload")
async def upload_dataset(
    name: str = Form(...),
    version: str = Form("v1"),
    file: UploadFile = File(...),
    user=Depends(verify_token),
):
    try:
        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")

        raw = await file.read()
        if len(raw) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File too large (max {settings.max_upload_mb}MB)")

        storage_meta = persist_artifact(raw, file.filename, "datasets")
        path = storage_meta["storage_path"]

        try:
            df = pd.read_csv(path)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}") from exc

        if df.empty:
            raise HTTPException(status_code=400, detail="Dataset is empty")

        preview = df.head(10).fillna("").to_dict(orient="records")
        schema_cols = []
        for col in df.columns:
            s = df[col]
            schema_cols.append({
                "name": col,
                "type": "numeric" if pd.api.types.is_numeric_dtype(s) else "categorical",
                "dtype": str(s.dtype),
                "missing_count": int(s.isna().sum()),
                "missing_ratio": round(float(s.isna().sum() / max(len(df), 1)), 4),
                "unique_count": int(s.nunique(dropna=True)),
            })

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
            "storage_path": storage_meta["storage_path"],
            "storage_backend": storage_meta["storage_backend"],
            "storage_key": storage_meta["storage_key"],
            "row_count": int(df.shape[0]),
            "column_count": int(df.shape[1]),
            "columns": list(df.columns),
            "schema": schema_cols,
            "profile": profile,
            "preview_sample": preview,
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

        return {
            "success": True,
            "data": {
                "id": str(result.inserted_id),
                "preview": preview,
                "schema": schema_cols,
                "profile": profile,
                "storageBackend": storage_meta["storage_backend"],
                "scan": {
                    "rowCount": int(df.shape[0]),
                    "columnCount": int(df.shape[1]),
                    "nullCells": int(df.isna().sum().sum()),
                },
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        LOGGER.exception("Dataset upload failed for tenant=%s", user.get("tenant_id"), exc_info=exc)
        raise HTTPException(status_code=500, detail="Dataset upload failed") from exc


@router.get("")
async def list_datasets(user=Depends(verify_token)):
    db = get_db()
    rows = await db.datasets.find({"tenant_id": user["tenant_id"]}).sort("created_at", -1).to_list(200)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return {"success": True, "data": rows}


@router.get("/{dataset_id}/preview")
async def dataset_preview(dataset_id: str, limit: str | None = Query("10"), user=Depends(verify_token)):
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(status_code=400, detail="Invalid dataset ID")

    parsed_limit = _safe_limit(limit)
    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id), "tenant_id": user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Dataset not found")

    storage_path = None
    preview = []
    row_count = int(doc.get("row_count", 0))
    column_count = int(doc.get("column_count", 0))
    columns = doc.get("columns", [])
    cache_only = False

    try:
        storage_path = resolve_artifact_path(doc, "dataset")
    except ArtifactStorageError:
        cached_preview = doc.get("preview_sample") or []
        preview = cached_preview[:parsed_limit]
        cache_only = True
        LOGGER.warning(
            "Preview fallback to cached sample for dataset_id=%s tenant=%s",
            dataset_id,
            user.get("tenant_id"),
        )
    if not cache_only:
        try:
            df = pd.read_csv(storage_path)
            row_count = int(df.shape[0])
            column_count = int(df.shape[1])
            columns = list(df.columns)
            preview = df.head(parsed_limit).fillna("").to_dict(orient="records")
        except Exception as exc:
            LOGGER.exception("Preview read failed for dataset_id=%s", dataset_id, exc_info=exc)
            raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}") from exc

    return {
        "success": True,
        "data": {
            "dataset_id": dataset_id,
            "name": doc.get("name"),
            "totalRows": row_count,
            "previewCount": len(preview),
            "row_count": row_count,
            "column_count": column_count,
            "columns": columns,
            "preview": preview,
            "limit": parsed_limit,
            "from_cache": cache_only,
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

    # Return cached schema if available
    if doc.get("schema"):
        return {
            "success": True,
            "data": {
                "dataset_id": dataset_id,
                "name": doc.get("name"),
                "row_count": doc.get("row_count"),
                "column_count": doc.get("column_count"),
                "columns": doc.get("schema"),
                "from_cache": True,
            },
        }

    # Fallback to reading file if schema not in DB (for older uploads)
    try:
        storage_path = resolve_artifact_path(doc, "dataset")
    except ArtifactStorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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

    # Optionally update doc with schema for next time
    await db.datasets.update_one({"_id": ObjectId(dataset_id)}, {"$set": {"schema": columns}})

    return {
        "success": True,
        "data": {
            "dataset_id": dataset_id,
            "name": doc.get("name"),
            "row_count": int(df.shape[0]),
            "column_count": int(df.shape[1]),
            "columns": columns,
            "from_cache": False,
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

    delete_artifact(doc)

    await write_audit(db, user["tenant_id"], user["uid"], "dataset_delete", "dataset", dataset_id, {"name": doc.get("name")})
    return {"success": True, "data": {"deleted_dataset_id": dataset_id}}
