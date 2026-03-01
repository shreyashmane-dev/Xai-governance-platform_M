import hashlib
import io
import pickle
from typing import Any

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)


def checksum_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def validate_model_bytes(raw: bytes) -> tuple[bool, str]:
    obj = None
    error_details = []
    
    # Try pickle
    try:
        obj = pickle.load(io.BytesIO(raw))
    except Exception as exc:
        error_details.append(f"Pickle error: {exc}")
    
    # Try joblib if pickle failed
    if obj is None:
        try:
            import joblib
            obj = joblib.load(io.BytesIO(raw))
        except Exception as exc:
            error_details.append(f"Joblib error: {exc}")

    if obj is None:
        return False, f"Unable to deserialize model. Details: {' | '.join(error_details)}"

    if not hasattr(obj, "predict"):
        return False, f"Uploaded object ({type(obj).__name__}) is not a valid estimator (missing .predict())"

    return True, obj.__class__.__name__


def compute_classification_metrics(y_true, y_pred, y_prob=None) -> dict[str, Any]:
    y_true_arr = np.asarray(y_true)
    y_pred_arr = np.asarray(y_pred)
    y_true_eval = y_true_arr
    y_pred_eval = y_pred_arr

    # Some uploaded models are regressors. Convert both arrays into a binary
    # decision space so quality metrics remain real and comparable.
    if _should_binarize(y_true_arr, y_pred_arr):
        y_true_eval, y_pred_eval = _binarize_targets(y_true_arr, y_pred_arr)

    try:
        accuracy = float(accuracy_score(y_true_eval, y_pred_eval))
        precision = float(precision_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        recall = float(recall_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        f1 = float(f1_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        matrix = confusion_matrix(y_true_eval, y_pred_eval).tolist()
    except Exception:
        y_true_eval, y_pred_eval = _binarize_targets(y_true_arr, y_pred_arr)
        accuracy = float(accuracy_score(y_true_eval, y_pred_eval))
        precision = float(precision_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        recall = float(recall_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        f1 = float(f1_score(y_true_eval, y_pred_eval, average="weighted", zero_division=0))
        matrix = confusion_matrix(y_true_eval, y_pred_eval).tolist()

    out = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "f1_score": f1,
        "confusion_matrix": matrix,
    }
    if y_prob is not None:
        try:
            out["auc"] = float(roc_auc_score(y_true_eval, y_prob, multi_class="ovr"))
        except Exception:
            out["auc"] = None
    return out


def _should_binarize(y_true_arr: np.ndarray, y_pred_arr: np.ndarray) -> bool:
    if y_true_arr.dtype.kind in {"f"} or y_pred_arr.dtype.kind in {"f"}:
        unique_true = len(np.unique(y_true_arr[~pd.isna(y_true_arr)]))
        unique_pred = len(np.unique(y_pred_arr[~pd.isna(y_pred_arr)]))
        return unique_true > 2 or unique_pred > 2
    return False


def _binarize_targets(y_true_arr: np.ndarray, y_pred_arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    threshold = float(np.nanmedian(y_true_arr.astype(float)))
    y_true_eval = (y_true_arr.astype(float) >= threshold).astype(int)
    y_pred_eval = (y_pred_arr.astype(float) >= threshold).astype(int)
    return y_true_eval, y_pred_eval


def compute_shap_summary(model, x_sample, feature_names: list[str], max_rows: int = 20) -> dict:
    x_frame = x_sample if isinstance(x_sample, pd.DataFrame) else pd.DataFrame(x_sample, columns=feature_names)
    try:
        import shap
    except Exception as exc:
        # Fallback path for environments where SHAP wheels are unavailable (e.g. Python 3.14).
        importance = None
        if hasattr(model, "feature_importances_"):
            importance = np.asarray(model.feature_importances_, dtype=float)
        elif hasattr(model, "coef_"):
            coef = np.asarray(model.coef_, dtype=float)
            if coef.ndim > 1:
                coef = np.mean(np.abs(coef), axis=0)
            importance = np.abs(coef)

        if importance is None or importance.size == 0:
            try:
                baseline_pred = model.predict(x_frame.to_numpy())
                importance_scores = []
                values = x_frame.to_numpy()
                for idx in range(values.shape[1]):
                    perturbed = values.copy()
                    shuffled = perturbed[:, idx].copy()
                    np.random.shuffle(shuffled)
                    perturbed[:, idx] = shuffled
                    changed_pred = model.predict(perturbed)
                    delta = np.mean(changed_pred != baseline_pred)
                    importance_scores.append(float(delta))
                importance = np.asarray(importance_scores, dtype=float)
            except Exception as inner_exc:
                raise RuntimeError(
                    "SHAP dependency is unavailable and fallback importance computation failed"
                ) from inner_exc

        ranked = sorted(zip(feature_names, importance.tolist()), key=lambda t: t[1], reverse=True)
        return {
            "global_importance": [{"feature": f, "value": float(v)} for f, v in ranked],
            "feature_importance": [{"feature": f, "value": float(v)} for f, v in ranked],
            "shap_values": [],
            "sample_size": int(x_frame.shape[0]),
            "method": "model_importance_fallback",
        }

    explainer = shap.Explainer(model, x_frame)
    shap_values = explainer(x_frame)
    values = np.asarray(shap_values.values)
    if values.ndim == 3:
        values = np.mean(np.abs(values), axis=2)
    importance = np.mean(np.abs(values), axis=0)
    ranked = sorted(zip(feature_names, importance.tolist()), key=lambda t: t[1], reverse=True)

    row_limit = min(max_rows, len(x_frame))
    sample_rows = []
    for idx in range(row_limit):
        sample_rows.append(
            {
                "row_index": idx,
                "values": {feature_names[col_idx]: float(values[idx][col_idx]) for col_idx in range(len(feature_names))},
            }
        )

    return {
        "global_importance": [{"feature": f, "value": float(v)} for f, v in ranked],
        "feature_importance": [{"feature": f, "value": float(v)} for f, v in ranked],
        "shap_values": sample_rows,
        "sample_size": int(x_frame.shape[0]),
        "method": "shap",
    }
