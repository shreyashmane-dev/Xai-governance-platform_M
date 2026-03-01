from __future__ import annotations

from pathlib import Path
from typing import Iterable
import pickle
import threading

import joblib
import pandas as pd
from bson import ObjectId
from fastapi import HTTPException


BACKEND_ROOT = Path(__file__).resolve().parents[2]
_CACHE_LOCK = threading.Lock()
_MODEL_CACHE: dict[str, tuple[str, object]] = {}
_DATASET_CACHE: dict[str, tuple[str, pd.DataFrame]] = {}


def _as_object_id(value: str):
    if ObjectId.is_valid(value):
        return ObjectId(value)
    return None


async def find_model_doc(db, tenant_id: str, model_id: str) -> dict | None:
    filters: list[dict] = [{"_id": model_id, "tenant_id": tenant_id}, {"id": model_id, "tenant_id": tenant_id}]
    oid = _as_object_id(model_id)
    if oid is not None:
        filters.append({"_id": oid, "tenant_id": tenant_id})
    for current_filter in filters:
        doc = await db.models.find_one(current_filter)
        if doc:
            return doc
    return None


async def find_dataset_doc(db, tenant_id: str, dataset_id: str) -> dict | None:
    filters: list[dict] = [{"_id": dataset_id, "tenant_id": tenant_id}, {"id": dataset_id, "tenant_id": tenant_id}]
    oid = _as_object_id(dataset_id)
    if oid is not None:
        filters.append({"_id": oid, "tenant_id": tenant_id})
    for current_filter in filters:
        doc = await db.datasets.find_one(current_filter)
        if doc:
            return doc
    return None


def _candidate_paths(doc: dict, artifact_id: str, resource_type: str) -> Iterable[Path]:
    storage_path = (doc.get("storage_path") or "").strip()
    file_name = (doc.get("file_name") or "").strip()

    if storage_path:
        path = Path(storage_path)
        yield path
        if not path.is_absolute():
            yield BACKEND_ROOT / path

    if file_name:
        yield BACKEND_ROOT / "uploads" / file_name

    storage_root = BACKEND_ROOT / "storage"
    if resource_type == "model":
        yield storage_root / "models" / f"{artifact_id}.pkl"
        yield storage_root / "models" / f"{artifact_id}.pickle"
    elif resource_type == "dataset":
        yield storage_root / "datasets" / f"{artifact_id}.csv"


def _resolve_existing_path(doc: dict, artifact_id: str, resource_type: str) -> Path:
    for candidate in _candidate_paths(doc, artifact_id, resource_type):
        if candidate.exists() and candidate.is_file():
            return candidate
    raise HTTPException(status_code=404, detail=f"{resource_type.capitalize()} artifact file not found")


def _file_signature(path: Path) -> str:
    stat = path.stat()
    return f"{path.resolve()}:{stat.st_mtime_ns}:{stat.st_size}"


def load_model(doc: dict, model_id: str):
    model_path = _resolve_existing_path(doc, model_id, "model")
    cache_key = str(model_path.resolve())
    signature = _file_signature(model_path)

    with _CACHE_LOCK:
        cached = _MODEL_CACHE.get(cache_key)
        if cached and cached[0] == signature:
            return cached[1]

    try:
        model = joblib.load(model_path)
    except Exception:
        try:
            with open(model_path, "rb") as src:
                model = pickle.load(src)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to load model artifact: {exc}") from exc

    with _CACHE_LOCK:
        _MODEL_CACHE[cache_key] = (signature, model)
    return model


def load_dataset(doc: dict, dataset_id: str) -> pd.DataFrame:
    dataset_path = _resolve_existing_path(doc, dataset_id, "dataset")
    cache_key = str(dataset_path.resolve())
    signature = _file_signature(dataset_path)

    with _CACHE_LOCK:
        cached = _DATASET_CACHE.get(cache_key)
        if cached and cached[0] == signature:
            return cached[1].copy(deep=False)

    try:
        df = pd.read_csv(dataset_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}") from exc

    with _CACHE_LOCK:
        _DATASET_CACHE[cache_key] = (signature, df)
    return df.copy(deep=False)


def align_features(model, x: pd.DataFrame) -> pd.DataFrame:
    model_features = list(getattr(model, "feature_names_in_", []) or [])
    if not model_features:
        return x

    aligned = x.copy()
    for column in model_features:
        if column not in aligned.columns:
            aligned[column] = 0.0
    return aligned[model_features]


def infer_target_column(model_doc: dict, df: pd.DataFrame, model) -> str | None:
    explicit_target = (model_doc.get("target_column") or "").strip()
    if explicit_target and explicit_target in df.columns:
        return explicit_target

    model_features = list(getattr(model, "feature_names_in_", []) or [])
    if model_features:
        remaining = [column for column in df.columns if column not in model_features]
        if len(remaining) == 1:
            return remaining[0]

    for candidate in ("target", "label", "y", "class", "outcome"):
        for column in df.columns:
            if column.lower() == candidate:
                return column

    if len(df.columns) >= 2:
        if model_features:
            for column in reversed(df.columns):
                if column not in model_features:
                    return column
        return df.columns[-1]
    return None
