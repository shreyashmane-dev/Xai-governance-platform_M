from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException

from app.services.artifact_service import align_features

BACKEND_ROOT = Path(__file__).resolve().parents[2]


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
    candidates = [
        BACKEND_ROOT / "storage" / "datasets" / f"{dataset_id}.csv",
    ]
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


def _load_model(model_path: Path) -> Any:
    try:
        return joblib.load(model_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load model with joblib: {exc}") from exc


def _load_dataset(dataset_path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(dataset_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset CSV: {exc}") from exc


def _to_2d_shap(values: np.ndarray) -> np.ndarray:
    if values.ndim == 3:
        return np.mean(values, axis=2)
    return values


def _encode_current_figure(plt, dpi: int = 300) -> str:
    buffer = BytesIO()
    plt.gcf().savefig(buffer, format="png", dpi=dpi, bbox_inches="tight")
    plt.close(plt.gcf())
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def run_shap_analysis(
    model_id: str,
    dataset_id: str,
    model_doc: dict,
    dataset_doc: dict,
    row_index: int = 0,
    max_rows: int = 200,
) -> dict:
    model_path = _resolve_model_path(model_id, model_doc)
    dataset_path = _resolve_dataset_path(dataset_id, dataset_doc)

    model = _load_model(model_path)
    dataset = _load_dataset(dataset_path)
    if dataset.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty")
    if dataset.shape[1] < 2:
        raise HTTPException(status_code=400, detail="Dataset must contain at least one feature and one target column")

    target_column = str(dataset.columns[-1])
    x = dataset.iloc[:, :-1].copy()
    x = align_features(model, x)
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no usable feature columns for SHAP")

    x = x.head(min(len(x), max_rows)).reset_index(drop=True)
    if row_index < 0 or row_index >= len(x):
        row_index = 0

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import shap

        explainer = shap.Explainer(model, x)
        shap_exp = explainer(x)

        values = np.asarray(shap_exp.values)
        values_2d = _to_2d_shap(values)
        abs_mean = np.mean(np.abs(values_2d), axis=0)

        features = [str(col) for col in x.columns]
        importance = [float(v) for v in abs_mean.tolist()]
        ranked_idx = np.argsort(abs_mean)[::-1]
        top_idx = ranked_idx[:10]

        total_importance = float(np.sum(abs_mean)) or 1.0
        top_table = [
            {
                "feature": features[i],
                "mean_shap_value": float(abs_mean[i]),
                "impact_percentage": float((abs_mean[i] / total_importance) * 100.0),
            }
            for i in top_idx
        ]

        # Global summary plot (bar summary)
        plt.figure(figsize=(11, 7))
        shap.summary_plot(values_2d, x, plot_type="bar", show=False, max_display=20)
        plt.title("Global SHAP Summary Plot", fontsize=14)
        plt.xlabel("mean(|SHAP value|)", fontsize=11)
        plt.tight_layout()
        summary_plot = _encode_current_figure(plt, dpi=300)

        # Global feature importance bar chart (custom)
        bar_features = [features[i] for i in top_idx][::-1]
        bar_values = [float(abs_mean[i]) for i in top_idx][::-1]
        plt.figure(figsize=(11, 7))
        plt.barh(bar_features, bar_values, color="#4f46e5")
        plt.title("Global SHAP Feature Importance", fontsize=14)
        plt.xlabel("Mean |SHAP Value|", fontsize=11)
        plt.ylabel("Features", fontsize=11)
        plt.tight_layout()
        bar_plot = _encode_current_figure(plt, dpi=300)

        # Beeswarm plot
        plt.figure(figsize=(11, 7))
        shap.summary_plot(values_2d, x, plot_type="dot", show=False, max_display=20)
        plt.title("SHAP Beeswarm Plot", fontsize=14)
        plt.xlabel("SHAP Impact on Model Output", fontsize=11)
        plt.tight_layout()
        beeswarm_plot = _encode_current_figure(plt, dpi=300)

        # Dependence plot for top feature
        dependence_feature = features[int(ranked_idx[0])] if len(features) else None
        if dependence_feature:
            plt.figure(figsize=(11, 7))
            shap.dependence_plot(dependence_feature, values_2d, x, show=False, interaction_index=None)
            plt.title(f"SHAP Dependence Plot: {dependence_feature}", fontsize=14)
            plt.xlabel(dependence_feature, fontsize=11)
            plt.ylabel("SHAP value", fontsize=11)
            plt.tight_layout()
            dependence_plot = _encode_current_figure(plt, dpi=300)
        else:
            dependence_plot = ""

        # Local explanation
        row_values = x.iloc[row_index]
        row_shap = values_2d[row_index]
        row_exp = shap_exp[row_index]

        try:
            prediction_raw = model.predict(x.iloc[[row_index]])
            prediction = float(np.asarray(prediction_raw).reshape(-1)[0])
        except Exception:
            prediction = float("nan")

        base_vals = np.asarray(shap_exp.base_values)
        if base_vals.ndim == 0:
            base_value = float(base_vals)
        elif base_vals.ndim == 1:
            base_value = float(base_vals[row_index])
        else:
            base_value = float(np.asarray(base_vals[row_index]).reshape(-1)[0])

        # Waterfall plot
        plt.figure(figsize=(11, 7))
        shap.plots.waterfall(row_exp, max_display=15, show=False)
        plt.title("Local SHAP Waterfall Plot", fontsize=14)
        plt.tight_layout()
        waterfall_plot = _encode_current_figure(plt, dpi=300)

        # Force plot rendered as matplotlib image
        plt.figure(figsize=(12, 3.6))
        shap.force_plot(base_value, row_shap, row_values, matplotlib=True, show=False)
        plt.title("Local SHAP Force Plot", fontsize=12)
        plt.tight_layout()
        force_plot = _encode_current_figure(plt, dpi=300)

        local_rows = []
        for idx in np.argsort(np.abs(row_shap))[::-1]:
            raw_value = row_values.iloc[idx]
            local_rows.append(
                {
                    "feature": features[idx],
                    "value": float(raw_value) if np.issubdtype(type(raw_value), np.number) else str(raw_value),
                    "shap_impact": float(row_shap[idx]),
                }
            )

        shap_rows_limited = []
        for ridx in range(min(len(values_2d), 50)):
            shap_rows_limited.append({features[cidx]: float(values_2d[ridx][cidx]) for cidx in range(len(features))})

        result = {
            "global": {
                "summary_plot": summary_plot,
                "bar_plot": bar_plot,
                "beeswarm_plot": beeswarm_plot,
                "dependence_plot": dependence_plot,
                "features": features,
                "importance": importance,
                "top_features_table": top_table,
                "image_mime": "image/png",
            },
            "local": {
                "row_index": int(row_index),
                "waterfall_plot": waterfall_plot,
                "force_plot": force_plot,
                "prediction": prediction,
                "base_value": base_value,
                "features": features,
                "values": [float(v) if np.issubdtype(type(v), np.number) else str(v) for v in row_values.tolist()],
                "shap_values": [float(v) for v in row_shap.tolist()],
                "contributions": local_rows,
                "image_mime": "image/png",
            },
            # Backward-compatible fields
            "features": features,
            "importance": importance,
            "global_importance": [{"feature": row["feature"], "value": row["mean_shap_value"]} for row in top_table],
            "feature_importance": [{"feature": row["feature"], "value": row["mean_shap_value"]} for row in top_table],
            "shap_values": shap_rows_limited,
            "sample_size": int(x.shape[0]),
            "model_type": model.__class__.__name__,
            "target_column": target_column,
            "method": "shap",
        }
        return result
    except HTTPException:
        raise
    except MemoryError as exc:
        raise HTTPException(status_code=500, detail=f"SHAP failed due to memory pressure: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"SHAP computation failed: {exc}") from exc
