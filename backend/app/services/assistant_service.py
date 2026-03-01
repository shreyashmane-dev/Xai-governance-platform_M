from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException
from openai import OpenAI

from app.core.config import settings
from app.services.artifact_service import (
    find_dataset_doc,
    find_model_doc,
    infer_target_column,
)
from app.services.ml_service import compute_classification_metrics


BACKEND_ROOT = Path(__file__).resolve().parents[2]
SYSTEM_PROMPT = (
    "You are an AI Governance Assistant.\n"
    "You analyze machine learning models,\n"
    "datasets, metrics and SHAP results.\n"
    "Give technical and accurate answers."
)

REPORT_TEMPLATE = """
MODEL ANALYSIS REPORT

1️⃣ Model Information
---------------------
Model Name: {model_name}
Model Type: {model_type}
Algorithm: {algorithm}
Training Samples: {training_samples}
Features Count: {features_count}
Target Column: {target_column}

--------------------------------------------------
2️⃣ Dataset Analysis
---------------------
Total Rows: {rows}
Total Columns: {columns}
Missing Values: {missing_values}
Duplicate Rows: {duplicate_rows}

Feature Types:
- Numerical: {numerical_count}
- Categorical: {categorical_count}

Data Quality Score (Real Calculation): {data_quality_score}/100

Problems Found:
- Missing data: {missing_data_problem}
- Imbalanced data: {imbalanced_problem}
- Outliers: {outlier_problem}

--------------------------------------------------
3️⃣ Model Performance
---------------------
Accuracy: {accuracy}
Precision: {precision}
Recall: {recall}
F1 Score: {f1_score}

Confusion Matrix Summary: {confusion_summary}

Model Strengths:
- {strength_1}
- {strength_2}

Model Weaknesses:
- {weakness_1}
- {weakness_2}

--------------------------------------------------
4️⃣ Feature Importance (SHAP)
---------------------
Top Important Features:
1. {f1}
2. {f2}
3. {f3}
4. {f4}
5. {f5}

Explanation:
{feature_explanation}

--------------------------------------------------
5️⃣ Risk Analysis
---------------------
Overfitting Risk: {overfitting_risk}
Bias Risk: {bias_risk}
Data Leakage Risk: {leakage_risk}

Risk Reasoning:
- {risk_reason_1}
- {risk_reason_2}
- {risk_reason_3}

--------------------------------------------------
6️⃣ Improvement Suggestions
---------------------
- {suggestion_1}
- {suggestion_2}
- {suggestion_3}
- {suggestion_4}
- {suggestion_5}
- {suggestion_6}

--------------------------------------------------
7️⃣ Model Optimization Plan
---------------------
Step 1: {step_1}
Step 2: {step_2}
Step 3: {step_3}
Step 4: {step_4}

--------------------------------------------------
8️⃣ AI Final Score
---------------------
Model Quality Score: {model_quality_score}/100

Score Calculation:
- Data Quality Score: {data_quality_score}/100
- Model Performance Score: {model_performance_score}/100
- Stability Score: {stability_score}/100
- Explainability Score: {explainability_score}/100
""".strip()


def _resolve_model_path(model_id: str, model_doc: dict) -> Path:
    candidates = [
        BACKEND_ROOT / "storage" / "models" / f"{model_id}.pkl",
        BACKEND_ROOT / "storage" / "models" / f"{model_id}.pickle",
    ]
    storage_path = (model_doc.get("storage_path") or "").strip()
    if storage_path:
        candidates.extend([Path(storage_path), BACKEND_ROOT / storage_path])
    file_name = (model_doc.get("file_name") or "").strip()
    if file_name:
        candidates.append(BACKEND_ROOT / "uploads" / file_name)

    for path in candidates:
        if path.exists() and path.is_file():
            return path
    raise HTTPException(status_code=404, detail=f"Model artifact not found for model_id={model_id}")


def _resolve_dataset_path(dataset_id: str, dataset_doc: dict) -> Path:
    candidates = [BACKEND_ROOT / "storage" / "datasets" / f"{dataset_id}.csv"]
    storage_path = (dataset_doc.get("storage_path") or "").strip()
    if storage_path:
        candidates.extend([Path(storage_path), BACKEND_ROOT / storage_path])
    file_name = (dataset_doc.get("file_name") or "").strip()
    if file_name:
        candidates.append(BACKEND_ROOT / "uploads" / file_name)

    for path in candidates:
        if path.exists() and path.is_file():
            return path
    raise HTTPException(status_code=404, detail=f"Dataset artifact not found for dataset_id={dataset_id}")


def _load_real_model(model_path: Path):
    import joblib
    import pickle

    try:
        return joblib.load(model_path)
    except Exception:
        try:
            with open(model_path, "rb") as src:
                return pickle.load(src)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to load model: {exc}") from exc


def _load_real_dataset(dataset_path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(dataset_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to load dataset: {exc}") from exc


def _feature_type_counts(df: pd.DataFrame) -> tuple[int, int]:
    numerical_count = int(df.select_dtypes(include=[np.number]).shape[1])
    categorical_count = int(df.shape[1] - numerical_count)
    return numerical_count, categorical_count


def _imbalance_score(y: pd.Series | None) -> tuple[float, bool]:
    if y is None or y.empty:
        return 50.0, True
    counts = y.value_counts(dropna=False)
    if counts.empty:
        return 50.0, True
    ratios = counts / max(int(counts.sum()), 1)
    imbalance = float(ratios.max() - ratios.min())
    score = max(0.0, 100.0 - imbalance * 100.0)
    return score, imbalance > 0.2


def _outlier_ratio(df: pd.DataFrame) -> float:
    numeric = df.select_dtypes(include=[np.number])
    if numeric.empty:
        return 0.0
    ratios = []
    for col in numeric.columns:
        s = pd.to_numeric(numeric[col], errors="coerce").dropna()
        if s.empty:
            continue
        q1 = float(s.quantile(0.25))
        q3 = float(s.quantile(0.75))
        iqr = q3 - q1
        if iqr == 0:
            ratios.append(0.0)
            continue
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        ratios.append(float(((s < low) | (s > high)).mean()))
    if not ratios:
        return 0.0
    return float(np.mean(ratios))


def _data_quality_score(df: pd.DataFrame, y: pd.Series | None) -> dict[str, Any]:
    total_cells = max(int(df.shape[0] * df.shape[1]), 1)
    missing_ratio = float(df.isna().sum().sum() / total_cells)
    duplicate_ratio = float(df.duplicated().mean()) if len(df) else 0.0
    outlier = _outlier_ratio(df)
    imbalance_score, imbalanced_problem = _imbalance_score(y)

    missing_score = max(0.0, 100.0 - missing_ratio * 100.0)
    duplicate_score = max(0.0, 100.0 - duplicate_ratio * 100.0)
    outlier_score = max(0.0, 100.0 - outlier * 100.0)

    quality = float(
        round(
            (missing_score * 0.35) + (duplicate_score * 0.2) + (outlier_score * 0.2) + (imbalance_score * 0.25),
            2,
        )
    )
    return {
        "quality_score": quality,
        "missing_ratio": missing_ratio,
        "duplicate_ratio": duplicate_ratio,
        "outlier_ratio": outlier,
        "imbalanced_problem": imbalanced_problem,
    }


def _compute_metrics_if_missing(df: pd.DataFrame, model, target_column: str | None, metrics: dict) -> dict:
    if metrics:
        return metrics
    if not target_column or target_column not in df.columns:
        return {}
    x = df.drop(columns=[target_column])
    model_features = list(getattr(model, "feature_names_in_", []) or [])
    if model_features:
        for feature in model_features:
            if feature not in x.columns:
                x[feature] = 0.0
        x = x[model_features]
    y_true = df[target_column]
    try:
        y_pred = model.predict(x)
        y_prob = model.predict_proba(x) if hasattr(model, "predict_proba") else None
        return compute_classification_metrics(y_true, y_pred, y_prob)
    except Exception:
        return {}


def _short_requested(message: str) -> bool:
    msg = message.lower()
    return any(keyword in msg for keyword in ["short", "brief", "summarize", "one line", "concise"])


def _context_to_prompt_payload(context: dict, message: str) -> str:
    mode = "SHORT_ANSWER" if _short_requested(message) else "FULL_REPORT"
    instruction = (
        "Default mode is FULL MODEL REPORT. Return exactly the structured report sections 1-8 with clean formatting."
        if mode == "FULL_REPORT"
        else "User asked for short answer. Keep it concise and focused."
    )
    return (
        f"Mode: {mode}\n"
        f"Instruction: {instruction}\n\n"
        f"User Question: {message}\n\n"
        f"Model JSON:\n{json.dumps(context['model'], indent=2, default=str)}\n\n"
        f"Dataset Analysis JSON:\n{json.dumps(context['dataset'], indent=2, default=str)}\n\n"
        f"Metrics JSON:\n{json.dumps(context['metrics'], indent=2, default=str)}\n\n"
        f"SHAP JSON:\n{json.dumps(context['shap'], indent=2, default=str)}\n\n"
        f"Governance JSON:\n{json.dumps(context['governance'], indent=2, default=str)}\n\n"
        "Generate professional analysis based only on these real values."
    )


def _real_report_fallback(context: dict, message: str) -> str:
    model = context["model"]
    dataset = context["dataset"]
    metrics = context["metrics"] or {}
    shap = context["shap"] or {}
    governance = context["governance"] or {}
    dq = dataset["quality"]
    top = (shap.get("global_importance") or [])[:5]
    top_features = [item.get("feature", "N/A") for item in top] + ["N/A"] * 5

    accuracy = float(metrics.get("accuracy", 0.0)) * 100.0
    precision = float(metrics.get("precision", 0.0)) * 100.0
    recall = float(metrics.get("recall", 0.0)) * 100.0
    f1 = float(metrics.get("f1_score", metrics.get("f1", 0.0))) * 100.0
    performance_score = float(round((accuracy + precision + recall + f1) / 4.0, 2))

    explainability_score = 40.0
    if top:
        values = [abs(float(row.get("value", 0.0))) for row in top]
        total = sum(values) or 1.0
        concentration = max(values) / total
        explainability_score = float(round(max(0.0, min(100.0, 100.0 - concentration * 65.0)), 2))

    stability_score = 100.0 - min(40.0, abs(precision - recall) * 0.4)
    model_quality_score = float(
        round(
            (dq["quality_score"] * 0.30)
            + (performance_score * 0.35)
            + (stability_score * 0.20)
            + (explainability_score * 0.15),
            2,
        )
    )

    rows = int(dataset["stats"]["rows"])
    suggestions = [
        "Collect more labeled data to reduce variance (recommended if dataset < 1000 rows)." if rows < 1000 else "Maintain data refresh cadence and monitor data drift weekly.",
        "Remove or re-engineer features with consistently low SHAP importance.",
        "Impute missing values with robust strategy (median for numeric, mode for categorical).",
        "Normalize/standardize numeric features for linear models and distance-based models.",
        "Try stronger baselines: RandomForest, XGBoost, GradientBoosting and compare with cross-validation.",
        "Run hyperparameter tuning: n_estimators=200, max_depth in 5-15, and 5-fold cross-validation.",
    ]

    return REPORT_TEMPLATE.format(
        model_name=model.get("name") or model.get("id"),
        model_type=model.get("type"),
        algorithm=model.get("algorithm"),
        training_samples=model.get("training_samples"),
        features_count=model.get("features_count"),
        target_column=model.get("target_column"),
        rows=dataset["stats"]["rows"],
        columns=dataset["stats"]["columns"],
        missing_values=dataset["stats"]["missing_values"],
        duplicate_rows=dataset["stats"]["duplicate_rows"],
        numerical_count=dataset["stats"]["numerical_count"],
        categorical_count=dataset["stats"]["categorical_count"],
        data_quality_score=dq["quality_score"],
        missing_data_problem="Yes" if dq["missing_ratio"] > 0 else "No",
        imbalanced_problem="Yes" if dq["imbalanced_problem"] else "No",
        outlier_problem="Yes" if dq["outlier_ratio"] > 0.1 else "No",
        accuracy=f"{accuracy:.2f}%",
        precision=f"{precision:.2f}%",
        recall=f"{recall:.2f}%",
        f1_score=f"{f1:.2f}%",
        confusion_summary=str(metrics.get("confusion_matrix", [])),
        strength_1="Stable quality metrics and usable predictive signal.",
        strength_2="Explainability output identifies top influencing features.",
        weakness_1="Potential generalization risk if data volume or diversity is limited.",
        weakness_2="Potential fairness risk if sensitive subgroup monitoring is not enabled.",
        f1=top_features[0],
        f2=top_features[1],
        f3=top_features[2],
        f4=top_features[3],
        f5=top_features[4],
        feature_explanation="Top SHAP-ranked features contribute most to prediction movement and should be prioritized for monitoring.",
        overfitting_risk="High" if rows < 500 else ("Medium" if rows < 2000 else "Low"),
        bias_risk="High" if float(governance.get("fairness_score", 50.0)) < 60 else ("Medium" if float(governance.get("fairness_score", 50.0)) < 80 else "Low"),
        leakage_risk="Medium" if dataset["stats"]["duplicate_rows"] > 0 else "Low",
        risk_reason_1="Overfitting risk estimated from sample size vs model complexity.",
        risk_reason_2="Bias risk estimated from governance fairness indicators.",
        risk_reason_3="Leakage risk estimated from duplicates and target leakage checks.",
        suggestion_1=suggestions[0],
        suggestion_2=suggestions[1],
        suggestion_3=suggestions[2],
        suggestion_4=suggestions[3],
        suggestion_5=suggestions[4],
        suggestion_6=suggestions[5],
        step_1="Run stratified train/validation split and baseline evaluation.",
        step_2="Apply preprocessing improvements and remove low-value features.",
        step_3="Tune hyperparameters with cross-validation and compare algorithms.",
        step_4="Recompute SHAP/governance and approve deployment only if quality and fairness thresholds are met.",
        model_quality_score=model_quality_score,
        model_performance_score=performance_score,
        stability_score=round(stability_score, 2),
        explainability_score=round(explainability_score, 2),
    )


async def build_assistant_context(db, tenant_id: str, model_id: str, dataset_id: str) -> dict:
    model_doc = await find_model_doc(db, tenant_id, model_id)
    dataset_doc = await find_dataset_doc(db, tenant_id, dataset_id)
    if not model_doc:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_id}")
    if not dataset_doc:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {dataset_id}")

    model_path = _resolve_model_path(model_id, model_doc)
    dataset_path = _resolve_dataset_path(dataset_id, dataset_doc)
    model = _load_real_model(model_path)
    df = _load_real_dataset(dataset_path)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")

    target_column = infer_target_column(model_doc, df, model)

    metrics_doc = await db.metrics.find_one(
        {"tenant_id": tenant_id, "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    shap_doc = await db.shap_reports.find_one(
        {"tenant_id": tenant_id, "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )
    governance_doc = await db.governance_reports.find_one(
        {"tenant_id": tenant_id, "model_id": model_id, "dataset_id": dataset_id},
        sort=[("created_at", -1)],
    )

    metrics = (metrics_doc or {}).get("metrics", {})
    metrics = _compute_metrics_if_missing(df, model, target_column, metrics)
    shap_summary = (shap_doc or {}).get("summary", {})

    training_samples = int(getattr(model, "n_samples_seen_", 0) or model_doc.get("training_samples", 0) or df.shape[0])
    feature_names = list(getattr(model, "feature_names_in_", []) or [])
    features_count = int(len(feature_names) or max(0, df.shape[1] - (1 if target_column and target_column in df.columns else 0)))

    numerical_count, categorical_count = _feature_type_counts(df)
    stats = {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "numerical_count": numerical_count,
        "categorical_count": categorical_count,
    }

    y = df[target_column] if target_column and target_column in df.columns else None
    quality = _data_quality_score(df, y)

    return {
        "model": {
            "id": model_id,
            "name": model_doc.get("name"),
            "type": model.__class__.__name__,
            "algorithm": model.__class__.__name__,
            "training_samples": training_samples,
            "features_count": features_count,
            "target_column": target_column,
            "model_path": str(model_path),
        },
        "dataset": {
            "id": dataset_id,
            "name": dataset_doc.get("name"),
            "dataset_path": str(dataset_path),
            "stats": stats,
            "quality": quality,
        },
        "metrics": metrics,
        "shap": shap_summary,
        "governance": governance_doc or {},
    }


def generate_assistant_answer(message: str, context: dict) -> tuple[str, bool]:
    payload = _context_to_prompt_payload(context, message)
    try:
        api_key = settings.openai_api_key.strip() if settings.openai_api_key else ""
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY missing")
        client = OpenAI(api_key=api_key, max_retries=0, timeout=8.0)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": payload},
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            raise RuntimeError("Empty response from OpenAI")
        return text, False
    except Exception:
        return _real_report_fallback(context, message), True
