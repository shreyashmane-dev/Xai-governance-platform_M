from __future__ import annotations

import io
import os
import pickle
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score

class Metrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float

class Fairness(BaseModel):
    available: bool
    reason: str | None = None
    sensitiveColumn: str | None = None
    groupPositiveRates: dict[str, float] | None = None
    demographicParityDiff: float | None = None

class FeatureImportance(BaseModel):
    feature: str
    value: float

class Explainability(BaseModel):
    featureImportance: list[FeatureImportance]
    shapSummary: list[FeatureImportance]

class EvaluationResponse(BaseModel):
    metrics: Metrics
    confusionMatrix: list[list[int]]
    fairness: Fairness
    explainability: Explainability
    preview: list[dict[str, Any]]
    rowCount: int
    columnCount: int

app = FastAPI(title="XAI ML Evaluator", version="1.0.0")

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))


def _check_extension(filename: str, allowed: tuple[str, ...], label: str) -> None:
    if not filename:
        raise HTTPException(status_code=400, detail=f"{label} filename missing")
    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail=f"{label} invalid type. Allowed: {', '.join(allowed)}")


def _sanitize_preview_cell(value: Any) -> Any:
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed.startswith(("=", "+", "-", "@")):
            return "'" + trimmed
    return value


def _feature_importance(model: Any, columns: list[str]) -> list[dict[str, float]]:
    values = None
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        if coef.ndim > 1:
            coef = np.mean(np.abs(coef), axis=0)
        values = np.abs(coef)
    if values is None or values.size == 0:
        return []
    limit = min(len(columns), len(values))
    ranked = sorted(
        [{"feature": columns[i], "value": float(values[i])} for i in range(limit)],
        key=lambda row: row["value"],
        reverse=True,
    )
    return ranked[:20]


def _shap_summary(model: Any, x: pd.DataFrame) -> list[dict[str, float]]:
    try:
        import shap
    except Exception:
        return []
    try:
        sample = x.head(min(len(x), 100))
        if sample.empty:
            return []
        explainer = shap.Explainer(model, sample)
        shap_values = explainer(sample).values
        arr = np.asarray(shap_values)
        if arr.ndim == 3:
            arr = np.mean(np.abs(arr), axis=2)
        importance = np.mean(np.abs(arr), axis=0)
        ranked = sorted(
            [{"feature": sample.columns[i], "value": float(importance[i])} for i in range(len(sample.columns))],
            key=lambda row: row["value"],
            reverse=True,
        )
        return ranked[:20]
    except Exception:
        return []


def _fairness(df: pd.DataFrame, y_true: pd.Series, y_pred: np.ndarray, sensitive_column: str | None) -> dict:
    if not sensitive_column or sensitive_column not in df.columns:
        return {"available": False, "reason": "Sensitive column not provided or not found"}

    groups = df[sensitive_column].astype(str)
    labels = list(pd.unique(y_true))
    positive_label = 1 if 1 in labels else labels[0]

    rates = {}
    for group_value in groups.unique():
        mask = groups == group_value
        if int(mask.sum()) == 0:
            continue
        rates[group_value] = float(np.mean(pd.Series(y_pred)[mask] == positive_label))

    parity_diff = float(max(rates.values()) - min(rates.values())) if len(rates) > 1 else 0.0
    return {
        "available": True,
        "sensitiveColumn": sensitive_column,
        "groupPositiveRates": rates,
        "demographicParityDiff": parity_diff,
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "ml-service", "storage": "in-memory-only"}


@app.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(
    dataset: UploadFile = File(...),
    model: UploadFile = File(...),
    target_column: str = Form("target"),
    sensitive_column: str = Form(""),
):
    _check_extension(dataset.filename or "", (".csv",), "dataset")
    _check_extension(model.filename or "", (".pkl", ".pickle"), "model")

    dataset_bytes = await dataset.read()
    model_bytes = await model.read()

    if len(dataset_bytes) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"dataset exceeds {MAX_UPLOAD_MB}MB limit")
    if len(model_bytes) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"model exceeds {MAX_UPLOAD_MB}MB limit")

    try:
        df = pd.read_csv(io.BytesIO(dataset_bytes))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")
    if target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_column}' missing in dataset")

    try:
        clf = pickle.loads(model_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model load failed: {exc}") from exc

    if not hasattr(clf, "predict"):
        raise HTTPException(status_code=400, detail="Uploaded model is not a valid estimator (predict missing)")

    y_true = df[target_column]
    x = df.drop(columns=[target_column])
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no feature columns")

    model_features = list(getattr(clf, "feature_names_in_", []) or [])
    if model_features:
        missing = [col for col in model_features if col not in x.columns]
        if missing:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Feature schema mismatch",
                    "missingFeatures": missing[:50],
                },
            )
        x = x[model_features]

    try:
        y_pred = clf.predict(x)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model prediction failed: {exc}") from exc

    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
    }

    matrix = confusion_matrix(y_true, y_pred).tolist()
    preview_df = df.head(10).fillna("")
    preview_rows = []
    for _, row in preview_df.iterrows():
        preview_rows.append({col: _sanitize_preview_cell(row[col]) for col in preview_df.columns})

    result = {
        "metrics": metrics,
        "confusionMatrix": matrix,
        "fairness": _fairness(df, y_true, y_pred, sensitive_column or None),
        "explainability": {
            "featureImportance": _feature_importance(clf, list(x.columns)),
            "shapSummary": _shap_summary(clf, x),
        },
        "preview": preview_rows,
        "rowCount": int(df.shape[0]),
        "columnCount": int(df.shape[1]),
    }

    del dataset_bytes
    del model_bytes
    return result
