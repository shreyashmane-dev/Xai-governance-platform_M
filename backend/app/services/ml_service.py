import hashlib
import io
import pickle
from typing import Any

import numpy as np
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
    try:
        obj = pickle.load(io.BytesIO(raw))
    except Exception as exc:
        return False, f"Unable to deserialize model: {exc}"

    if not hasattr(obj, "predict"):
        return False, "Uploaded pickle is not a valid sklearn-like estimator"

    module_name = obj.__class__.__module__
    if "sklearn" not in module_name and "xgboost" not in module_name:
        return False, f"Unsupported model source: {module_name}"

    return True, obj.__class__.__name__


def compute_classification_metrics(y_true, y_pred, y_prob=None) -> dict[str, Any]:
    out = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
    if y_prob is not None:
        try:
            out["auc"] = float(roc_auc_score(y_true, y_prob, multi_class="ovr"))
        except Exception:
            out["auc"] = None
    return out


def compute_shap_summary(model, x_sample: np.ndarray, feature_names: list[str]) -> dict:
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
                baseline_pred = model.predict(x_sample)
                importance_scores = []
                for idx in range(x_sample.shape[1]):
                    perturbed = x_sample.copy()
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
            "sample_size": int(x_sample.shape[0]),
            "method": "model_importance_fallback",
        }

    explainer = shap.Explainer(model, x_sample)
    shap_values = explainer(x_sample)
    values = np.asarray(shap_values.values)
    if values.ndim == 3:
        values = np.mean(np.abs(values), axis=2)
    importance = np.mean(np.abs(values), axis=0)
    ranked = sorted(zip(feature_names, importance.tolist()), key=lambda t: t[1], reverse=True)
    return {
        "global_importance": [{"feature": f, "value": float(v)} for f, v in ranked],
        "sample_size": int(x_sample.shape[0]),
        "method": "shap",
    }
