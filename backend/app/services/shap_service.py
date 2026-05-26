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
from app.utils.storage import ArtifactStorageError, resolve_artifact_path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _resolve_model_path(model_id: str, model_doc: dict) -> Path:
    try:
        return Path(resolve_artifact_path(model_doc, "model"))
    except ArtifactStorageError:
        pass

    candidates = [
        BACKEND_ROOT / "storage" / "models" / f"{model_id}.pkl",
        BACKEND_ROOT / "storage" / "models" / f"{model_id}.pickle",
    ]
    storage_path = (model_doc.get("storage_path") or "").strip()
    if storage_path:
        candidates.extend([Path(storage_path), Path.cwd() / storage_path, Path.cwd().parent / storage_path, BACKEND_ROOT / storage_path])
    file_name = (model_doc.get("file_name") or "").strip()
    if file_name:
        candidates.append(BACKEND_ROOT / "uploads" / file_name)

    for path in candidates:
        if path.exists() and path.is_file():
            return path
    raise HTTPException(status_code=404, detail=f"Model artifact not found for model_id={model_id}")


def _resolve_dataset_path(dataset_id: str, dataset_doc: dict) -> Path:
    try:
        return Path(resolve_artifact_path(dataset_doc, "dataset"))
    except ArtifactStorageError:
        pass

    candidates = [
        BACKEND_ROOT / "storage" / "datasets" / f"{dataset_id}.csv",
    ]
    storage_path = (dataset_doc.get("storage_path") or "").strip()
    if storage_path:
        candidates.extend([Path(storage_path), Path.cwd() / storage_path, Path.cwd().parent / storage_path, BACKEND_ROOT / storage_path])
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
    except Exception:
        try:
            import pickle

            with open(model_path, "rb") as src:
                return pickle.load(src)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to load model artifact: {exc}") from exc


def _load_dataset(dataset_path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(dataset_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset CSV: {exc}") from exc


def _to_2d_shap(values: np.ndarray, output_index: int | None = None, aggregate_abs: bool = False) -> np.ndarray:
    if values.ndim == 3:
        if output_index is not None and 0 <= output_index < values.shape[2]:
            return values[:, :, output_index]
        if aggregate_abs:
            return np.mean(np.abs(values), axis=2)
        return np.mean(values, axis=2)
    return values


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        if np.isfinite(parsed):
            return parsed
    except Exception:
        pass
    return default


def _finite_array(values: Any) -> np.ndarray:
    return np.nan_to_num(np.asarray(values, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)


def _finite_frame(x: pd.DataFrame) -> pd.DataFrame:
    clean = x.apply(pd.to_numeric, errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return pd.DataFrame(_finite_array(clean.to_numpy()), columns=clean.columns, index=clean.index)


def _feature_stats(x: pd.DataFrame, shap_values: np.ndarray, abs_mean: np.ndarray) -> list[dict[str, Any]]:
    total = float(np.sum(abs_mean)) or 1.0
    rows: list[dict[str, Any]] = []
    for idx, feature in enumerate(x.columns):
        series = x[feature]
        vals = shap_values[:, idx]
        positive_rate = float(np.mean(vals > 0)) if len(vals) else 0.0
        rows.append(
            {
                "feature": str(feature),
                "mean_abs_shap": _safe_float(abs_mean[idx]),
                "mean_shap": _safe_float(np.mean(vals)),
                "median_shap": _safe_float(np.median(vals)),
                "std_shap": _safe_float(np.std(vals)),
                "p05_shap": _safe_float(np.percentile(vals, 5)),
                "p95_shap": _safe_float(np.percentile(vals, 95)),
                "impact_percentage": _safe_float((abs_mean[idx] / total) * 100.0),
                "direction": "increases output" if positive_rate >= 0.6 else ("decreases output" if positive_rate <= 0.4 else "mixed"),
                "positive_impact_rate": positive_rate,
                "missing_count": int(series.isna().sum()),
                "unique_count": int(series.nunique(dropna=True)),
            }
        )
    rows.sort(key=lambda row: row["mean_abs_shap"], reverse=True)
    return rows


def _correlation_rows(x: pd.DataFrame, shap_values: np.ndarray, features: list[str], ranked_idx: np.ndarray, limit: int = 8) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx in ranked_idx[:limit]:
        series = pd.to_numeric(x.iloc[:, int(idx)], errors="coerce")
        if series.notna().sum() < 3 or float(series.std(skipna=True) or 0.0) == 0.0:
            corr = 0.0
        else:
            corr = _safe_float(np.corrcoef(series.fillna(series.median()).to_numpy(), shap_values[:, int(idx)])[0, 1])
        rows.append({"feature": features[int(idx)], "value_shap_correlation": corr})
    return rows


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

    configured_target = str(model_doc.get("target_column") or "").strip()
    target_column = configured_target if configured_target in dataset.columns else str(dataset.columns[-1])
    x = dataset.drop(columns=[target_column]).copy()
    x = align_features(model, x)
    x = _finite_frame(x)
    if x.empty:
        raise HTTPException(status_code=400, detail="Dataset has no usable feature columns for SHAP")

    x = x.head(min(len(x), max_rows)).reset_index(drop=True)
    if row_index < 0 or row_index >= len(x):
        row_index = 0

    try:
        prediction_raw_all = model.predict(x)
    except Exception:
        prediction_raw_all = np.array([])

    output_index = None
    probabilities = None
    if hasattr(model, "predict_proba"):
        try:
            probabilities = np.asarray(model.predict_proba(x.iloc[[row_index]])).reshape(-1).tolist()
            output_index = int(np.argmax(probabilities)) if probabilities else None
        except Exception:
            probabilities = None

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import shap

        explainer = shap.Explainer(model, x)
        shap_exp = explainer(x)

        values = _finite_array(shap_exp.values)
        values_2d = _finite_array(_to_2d_shap(values, output_index=output_index))
        values_for_global = _finite_array(_to_2d_shap(values, output_index=output_index, aggregate_abs=True))
        if values_for_global.ndim != 2:
            values_for_global = values_2d
        if values_2d.ndim != 2:
            raise HTTPException(status_code=400, detail="SHAP returned an unsupported value shape")
        abs_mean = _finite_array(np.mean(np.abs(values_for_global), axis=0))

        features = [str(col) for col in x.columns]
        importance = [float(v) for v in abs_mean.tolist()]
        ranked_idx = np.argsort(abs_mean)[::-1]
        top_idx = ranked_idx[:10]
        feature_diagnostics = _feature_stats(x, values_2d, abs_mean)

        total_importance = float(np.sum(abs_mean)) or 1.0
        top_table = [
            {
                "feature": features[i],
                "mean_shap_value": float(abs_mean[i]),
                "mean_signed_shap": _safe_float(np.mean(values_2d[:, i])),
                "direction": next((row["direction"] for row in feature_diagnostics if row["feature"] == features[i]), "mixed"),
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
        row_shap = _finite_array(values_2d[row_index])
        row_exp = shap_exp[row_index]
        if values.ndim == 3 and output_index is not None:
            try:
                row_exp = shap.Explanation(
                    values=_finite_array(values[row_index, :, output_index]),
                    base_values=_safe_float(np.asarray(shap_exp.base_values)[row_index, output_index]),
                    data=row_values.to_numpy(),
                    feature_names=features,
                )
            except Exception:
                row_exp = shap_exp[row_index]

        try:
            prediction_raw = model.predict(x.iloc[[row_index]])
            prediction = float(np.asarray(prediction_raw).reshape(-1)[0])
        except Exception:
            prediction = float("nan")

        base_vals = np.asarray(shap_exp.base_values)
        if base_vals.ndim == 0:
            base_value = _safe_float(base_vals)
        elif base_vals.ndim == 1:
            base_value = _safe_float(base_vals[row_index])
        else:
            row_base = np.asarray(base_vals[row_index]).reshape(-1)
            base_value = _safe_float(row_base[output_index] if output_index is not None and output_index < len(row_base) else row_base[0])

        row_exp = shap.Explanation(
            values=row_shap,
            base_values=base_value,
            data=row_values.to_numpy(),
            feature_names=features,
        )

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
                    "absolute_impact": float(abs(row_shap[idx])),
                    "direction": "pushes prediction up" if row_shap[idx] >= 0 else "pushes prediction down",
                }
            )

        shap_rows_limited = []
        for ridx in range(min(len(values_2d), 50)):
            shap_rows_limited.append({features[cidx]: float(values_2d[ridx][cidx]) for cidx in range(len(features))})

        positive_drivers = [row for row in local_rows if row["shap_impact"] > 0][:10]
        negative_drivers = [row for row in local_rows if row["shap_impact"] < 0][:10]
        prediction_distribution = {}
        if len(prediction_raw_all):
            prediction_distribution = pd.Series(prediction_raw_all).astype(str).value_counts(normalize=True).head(20).to_dict()

        result = {
            "global": {
                "summary_plot": summary_plot,
                "bar_plot": bar_plot,
                "beeswarm_plot": beeswarm_plot,
                "dependence_plot": dependence_plot,
                "features": features,
                "importance": importance,
                "top_features_table": top_table,
                "feature_diagnostics": feature_diagnostics,
                "directional_impact": {
                    "top_positive": sorted(feature_diagnostics, key=lambda row: row["mean_shap"], reverse=True)[:10],
                    "top_negative": sorted(feature_diagnostics, key=lambda row: row["mean_shap"])[:10],
                    "value_correlations": _correlation_rows(x, values_2d, features, ranked_idx),
                },
                "prediction_distribution": prediction_distribution,
                "image_mime": "image/png",
            },
            "local": {
                "row_index": int(row_index),
                "waterfall_plot": waterfall_plot,
                "force_plot": force_plot,
                "prediction": prediction,
                "probabilities": probabilities,
                "explained_output_index": output_index,
                "base_value": base_value,
                "features": features,
                "values": [float(v) if np.issubdtype(type(v), np.number) else str(v) for v in row_values.tolist()],
                "shap_values": [float(v) for v in row_shap.tolist()],
                "contributions": local_rows,
                "positive_drivers": positive_drivers,
                "negative_drivers": negative_drivers,
                "net_effect": float(np.sum(row_shap)),
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
            "analysis_quality": {
                "rows_explained": int(x.shape[0]),
                "features_explained": int(x.shape[1]),
                "top_feature_concentration": float(sum(abs_mean[top_idx[:3]]) / total_importance) if len(top_idx) else 0.0,
                "explainer": explainer.__class__.__name__,
            },
            "method": "shap",
        }
        return result
    except HTTPException:
        raise
    except MemoryError as exc:
        raise HTTPException(status_code=500, detail=f"SHAP failed due to memory pressure: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"SHAP computation failed: {exc}") from exc
