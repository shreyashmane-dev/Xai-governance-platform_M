from __future__ import annotations

import csv
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from app.core.security import verify_token
from app.db.mongo import get_db

router = APIRouter()

BACKEND_ROOT = Path(__file__).resolve().parents[3]
MODELS_DIR = BACKEND_ROOT / "storage" / "models"
DATASETS_DIR = BACKEND_ROOT / "storage" / "datasets"
AUDIT_CSV_PATH = BACKEND_ROOT / "storage" / "audit_logs.csv"


def _contains(value: str, query: str) -> bool:
    return query in (value or "").lower()


def _scan_models(query: str) -> list[dict]:
    rows: list[dict] = []
    if not MODELS_DIR.exists():
        return rows
    for path in MODELS_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".pkl", ".pickle"}:
            continue
        model_id = path.stem
        model_name = path.name
        if _contains(model_id, query) or _contains(model_name, query):
            rows.append({"id": model_id, "name": model_name})
    return sorted(rows, key=lambda item: item["name"].lower())[:50]


def _scan_datasets(query: str) -> list[dict]:
    rows: list[dict] = []
    if not DATASETS_DIR.exists():
        return rows
    for path in DATASETS_DIR.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() != ".csv":
            continue
        dataset_id = path.stem
        dataset_name = path.name
        if _contains(dataset_id, query) or _contains(dataset_name, query):
            rows.append({"id": dataset_id, "name": dataset_name})
    return sorted(rows, key=lambda item: item["name"].lower())[:50]


def _scan_audit_csv(query: str) -> list[dict]:
    rows: list[dict] = []
    if not AUDIT_CSV_PATH.exists() or not AUDIT_CSV_PATH.is_file():
        return rows

    with AUDIT_CSV_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            timestamp = row.get("timestamp") or row.get("created_at") or ""
            action = row.get("action") or ""
            model_id = row.get("model_id") or ""
            dataset_id = row.get("dataset_id") or ""
            if any(
                _contains(value, query)
                for value in (timestamp, action, model_id, dataset_id)
            ):
                rows.append(
                    {
                        "timestamp": timestamp,
                        "action": action,
                        "model_id": model_id,
                        "dataset_id": dataset_id,
                    }
                )
            if len(rows) >= 100:
                break
    return rows


@router.get("")
async def search_all(
    q: str = Query("", min_length=0),
    user=Depends(verify_token),
):
    db = get_db()
    query = q.strip().lower()
    if len(query) < 2:
        return {"success": True, "data": {"models": [], "datasets": [], "audit_logs": [], "reports": []}}

    models = _scan_models(query)
    datasets = _scan_datasets(query)
    audit_logs = _scan_audit_csv(query)

    report_rows = []
    cursor = db.reports.find({"tenant_id": user["tenant_id"]}).sort("generated_at", -1)
    docs = await cursor.to_list(200)
    for row in docs:
        report_id = str(row.get("_id"))
        model_id = str(row.get("model_id", ""))
        dataset_id = str(row.get("dataset_id", ""))
        generated_at = row.get("generated_at")
        generated_at_text = generated_at.isoformat() if hasattr(generated_at, "isoformat") else str(generated_at or "")
        if any(_contains(value, query) for value in (report_id, model_id, dataset_id, generated_at_text)):
            report_rows.append(
                {
                    "id": report_id,
                    "model_id": model_id,
                    "dataset_id": dataset_id,
                    "generated_at": generated_at_text,
                }
            )
        if len(report_rows) >= 50:
            break

    return {
        "success": True,
        "data": {
            "models": models,
            "datasets": datasets,
            "audit_logs": audit_logs,
            "reports": report_rows,
        },
    }
