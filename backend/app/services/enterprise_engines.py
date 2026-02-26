from __future__ import annotations

import hashlib
import io
import pickle
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.inspection import partial_dependence
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# PART 1 - MODEL INGESTION ENGINE
def upload_trained_model(raw_bytes: bytes) -> Any:
    return pickle.load(io.BytesIO(raw_bytes))


def validate_model_type(model: Any) -> str:
    if hasattr(model, "predict_proba"):
        return "classification"
    return "regression"


def auto_detect_feature_names(model: Any, dataset: pd.DataFrame | None = None) -> list[str]:
    model_features = list(getattr(model, "feature_names_in_", []) or [])
    if model_features:
        return model_features
    if dataset is not None:
        return list(dataset.columns)
    return []


def validate_model_dataset_compatibility(model: Any, x: pd.DataFrame) -> tuple[bool, str]:
    expected = getattr(model, "n_features_in_", None)
    if expected is not None and int(expected) != int(x.shape[1]):
        return False, f"Feature mismatch: model expects {expected}, dataset has {x.shape[1]}"
    try:
        model.predict(x.head(min(len(x), 3)))
    except Exception as exc:
        return False, f"Model prediction compatibility check failed: {exc}"
    return True, "compatible"


def extract_model_metadata(model: Any) -> dict[str, Any]:
    classes = getattr(model, "classes_", None)
    params = model.get_params(deep=False) if hasattr(model, "get_params") else {}
    return {
        "model_class": model.__class__.__name__,
        "module": model.__class__.__module__,
        "model_type": validate_model_type(model),
        "n_features": int(getattr(model, "n_features_in_", 0) or 0),
        "classes": classes.tolist() if hasattr(classes, "tolist") else (classes or []),
        "hyperparameters": params,
    }


def generate_model_fingerprint(raw_bytes: bytes) -> str:
    return hashlib.sha256(raw_bytes).hexdigest()


def next_model_version(existing_versions: list[str]) -> str:
    nums = []
    for version in existing_versions:
        if isinstance(version, str) and version.startswith("v"):
            try:
                nums.append(int(version[1:]))
            except ValueError:
                continue
    return f"v{(max(nums) if nums else 0) + 1}"


# PART 2 - DATASET VALIDATION ENGINE
def schema_validation(df: pd.DataFrame, required_columns: list[str] | None = None) -> dict[str, Any]:
    required = required_columns or []
    missing = [c for c in required if c not in df.columns]
    return {"valid": len(missing) == 0, "missing_columns": missing, "columns": list(df.columns)}


def missing_value_detection(df: pd.DataFrame) -> dict[str, Any]:
    missing_counts = df.isna().sum().to_dict()
    total_cells = int(df.shape[0] * df.shape[1]) or 1
    missing_cells = int(sum(missing_counts.values()))
    return {"missing_counts": missing_counts, "missing_ratio": float(missing_cells / total_cells)}


def feature_type_inference(df: pd.DataFrame) -> dict[str, str]:
    out: dict[str, str] = {}
    for col in df.columns:
        series = df[col]
        if pd.api.types.is_numeric_dtype(series):
            out[col] = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            out[col] = "datetime"
        else:
            out[col] = "categorical"
    return out


def outlier_detection_iqr(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        if s.empty:
            out[col] = {"outlier_ratio": 0.0, "lower": 0.0, "upper": 0.0}
            continue
        q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        ratio = float(((s < lower) | (s > upper)).mean())
        out[col] = {"outlier_ratio": ratio, "lower": lower, "upper": upper}
    return out


def feature_distribution_summary(df: pd.DataFrame) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_numeric_dtype(s):
            s_num = pd.to_numeric(s, errors="coerce")
            out[col] = {
                "type": "numeric",
                "mean": float(s_num.mean(skipna=True) or 0.0),
                "std": float(s_num.std(skipna=True) or 0.0),
                "p05": float(s_num.quantile(0.05) or 0.0),
                "p95": float(s_num.quantile(0.95) or 0.0),
            }
        else:
            vc = s.fillna("NA").astype(str).value_counts(normalize=True).head(10)
            out[col] = {"type": "categorical", "top_values": vc.to_dict()}
    return out


def data_imbalance_analysis(y: pd.Series) -> dict[str, Any]:
    counts = y.value_counts(dropna=False)
    ratios = (counts / max(int(counts.sum()), 1)).to_dict()
    majority = float(max(ratios.values())) if ratios else 0.0
    return {"class_distribution": counts.to_dict(), "class_ratios": ratios, "imbalance_ratio": majority}


def correlation_detection(df: pd.DataFrame, threshold: float = 0.9) -> dict[str, Any]:
    numeric = df.select_dtypes(include=[np.number])
    if numeric.empty:
        return {"high_correlation_pairs": []}
    corr = numeric.corr().abs()
    pairs = []
    cols = list(corr.columns)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            score = float(corr.iloc[i, j])
            if score >= threshold:
                pairs.append({"feature_a": cols[i], "feature_b": cols[j], "correlation": score})
    return {"high_correlation_pairs": pairs}


def build_drift_baseline(df: pd.DataFrame) -> dict[str, Any]:
    return {
        "created_at": utc_now(),
        "row_count": int(df.shape[0]),
        "column_count": int(df.shape[1]),
        "distribution_summary": feature_distribution_summary(df),
    }


# PART 3 - PERFORMANCE METRICS ENGINE
def compute_performance_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray | None = None) -> dict[str, Any]:
    labels = np.unique(y_true)
    metrics = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "labels": labels.tolist(),
    }
    if y_prob is not None:
        try:
            if len(labels) == 2 and y_prob.ndim > 1:
                auc = roc_auc_score(y_true, y_prob[:, 1])
                fpr, tpr, _ = roc_curve(y_true, y_prob[:, 1], pos_label=labels[-1])
                prob_true, prob_pred = calibration_curve((y_true == labels[-1]).astype(int), y_prob[:, 1], n_bins=10)
            else:
                auc = roc_auc_score(y_true, y_prob, multi_class="ovr")
                fpr, tpr, prob_true, prob_pred = np.array([]), np.array([]), np.array([]), np.array([])
            metrics["auc"] = float(auc)
            metrics["roc_curve"] = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
            metrics["calibration_curve"] = {"prob_true": prob_true.tolist(), "prob_pred": prob_pred.tolist()}
        except Exception:
            metrics["auc"] = None
            metrics["roc_curve"] = {"fpr": [], "tpr": []}
            metrics["calibration_curve"] = {"prob_true": [], "prob_pred": []}
    return metrics


def compute_cross_validation_stability(model: Any, x: pd.DataFrame, y: pd.Series, folds: int = 5) -> dict[str, Any]:
    n = int(min(max(3, folds), max(3, len(y))))
    if len(y) < n:
        return {"cv_scores": [], "cv_mean": 0.0, "stability_score": 0.0}
    skf = StratifiedKFold(n_splits=n, shuffle=True, random_state=42)
    scores = cross_val_score(model, x, y, cv=skf, scoring="f1_weighted")
    cv_mean = float(np.mean(scores))
    cv_std = float(np.std(scores))
    stability = float(max(0.0, min(100.0, (cv_mean - cv_std) * 100.0)))
    return {"cv_scores": scores.tolist(), "cv_mean": cv_mean, "cv_std": cv_std, "stability_score": stability}


# PART 4 - EXPLAINABILITY ENGINE
def shap_global_feature_importance(model: Any, x_sample: pd.DataFrame) -> dict[str, Any]:
    import shap

    explainer = shap.Explainer(model, x_sample)
    values = explainer(x_sample).values
    arr = np.asarray(values)
    if arr.ndim == 3:
        arr = np.mean(np.abs(arr), axis=2)
    importance = np.mean(np.abs(arr), axis=0)
    ranked = sorted(zip(list(x_sample.columns), importance.tolist()), key=lambda item: item[1], reverse=True)
    return {"global_importance": [{"feature": f, "value": float(v)} for f, v in ranked]}


def shap_local_explanation(model: Any, one_row: pd.DataFrame) -> dict[str, Any]:
    import shap

    explainer = shap.Explainer(model, one_row)
    values = explainer(one_row).values
    vec = np.asarray(values)
    if vec.ndim == 3:
        vec = np.mean(vec, axis=2)
    row_vals = vec[0]
    pairs = sorted(zip(list(one_row.columns), row_vals.tolist()), key=lambda item: abs(item[1]), reverse=True)
    return {"local_contributions": [{"feature": f, "shap_value": float(v)} for f, v in pairs]}


def shap_consistency_score(global_a: list[dict[str, float]], global_b: list[dict[str, float]]) -> float:
    if not global_a or not global_b:
        return 0.0
    rank_a = {x["feature"]: i for i, x in enumerate(global_a)}
    rank_b = {x["feature"]: i for i, x in enumerate(global_b)}
    common = [f for f in rank_a if f in rank_b]
    if len(common) < 2:
        return 0.0
    a = np.array([rank_a[f] for f in common], dtype=float)
    b = np.array([rank_b[f] for f in common], dtype=float)
    corr = np.corrcoef(a, b)[0, 1]
    return float(max(0.0, min(100.0, (corr + 1.0) * 50.0)))


def feature_influence_ranking(global_importance: list[dict[str, float]]) -> list[dict[str, Any]]:
    return [{"rank": i + 1, **row} for i, row in enumerate(global_importance)]


def top_risk_drivers(local_explanation: list[dict[str, float]], limit: int = 5) -> list[dict[str, float]]:
    sorted_rows = sorted(local_explanation, key=lambda x: abs(float(x.get("shap_value", 0.0))), reverse=True)
    return sorted_rows[: max(1, limit)]


def partial_dependence_computation(model: Any, x: pd.DataFrame, features: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for feature in features:
        if feature not in x.columns:
            continue
        idx = list(x.columns).index(feature)
        pd_result = partial_dependence(model, x, [idx], kind="average")
        out[feature] = {
            "grid_values": pd_result["grid_values"][0].tolist(),
            "average": pd_result["average"][0].tolist(),
        }
    return out


def interaction_effect_detection(x: pd.DataFrame, top_k: int = 10) -> list[dict[str, Any]]:
    numeric = x.select_dtypes(include=[np.number])
    if numeric.shape[1] < 2:
        return []
    corr = numeric.corr().abs()
    pairs: list[dict[str, Any]] = []
    cols = list(corr.columns)
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            pairs.append({"feature_a": cols[i], "feature_b": cols[j], "interaction_score": float(corr.iloc[i, j])})
    pairs.sort(key=lambda item: item["interaction_score"], reverse=True)
    return pairs[:top_k]


def explanation_confidence_score(consistency_score: float, sample_size: int) -> float:
    size_boost = min(20.0, np.log1p(max(0, sample_size)) * 3.0)
    return float(max(0.0, min(100.0, consistency_score * 0.8 + size_boost)))


# PART 5 - FAIRNESS ENGINE
def demographic_parity(y_pred: pd.Series, sensitive: pd.Series) -> dict[str, Any]:
    rates = {}
    for group in sensitive.dropna().unique():
        mask = sensitive == group
        rates[str(group)] = float((y_pred[mask] == 1).mean()) if int(mask.sum()) > 0 else 0.0
    diff = float(max(rates.values()) - min(rates.values())) if len(rates) > 1 else 0.0
    return {"group_positive_rates": rates, "demographic_parity_diff": diff}


def equal_opportunity(y_true: pd.Series, y_pred: pd.Series, sensitive: pd.Series) -> dict[str, Any]:
    tpr = {}
    for group in sensitive.dropna().unique():
        mask = sensitive == group
        positives = (y_true[mask] == 1)
        denom = int(positives.sum())
        if denom == 0:
            continue
        tpr[str(group)] = float(((y_pred[mask] == 1) & positives).sum() / denom)
    diff = float(max(tpr.values()) - min(tpr.values())) if len(tpr) > 1 else 0.0
    return {"group_tpr": tpr, "equal_opportunity_diff": diff}


def predictive_parity(y_true: pd.Series, y_pred: pd.Series, sensitive: pd.Series) -> dict[str, Any]:
    ppv = {}
    for group in sensitive.dropna().unique():
        mask = (sensitive == group) & (y_pred == 1)
        denom = int(mask.sum())
        ppv[str(group)] = float((y_true[mask] == 1).sum() / denom) if denom > 0 else 0.0
    diff = float(max(ppv.values()) - min(ppv.values())) if len(ppv) > 1 else 0.0
    return {"group_ppv": ppv, "predictive_parity_diff": diff}


def subgroup_performance_comparison(y_true: pd.Series, y_pred: pd.Series, sensitive: pd.Series) -> list[dict[str, Any]]:
    rows = []
    for group in sensitive.dropna().unique():
        mask = sensitive == group
        rows.append(
            {
                "group": str(group),
                "count": int(mask.sum()),
                "accuracy": float(accuracy_score(y_true[mask], y_pred[mask])) if int(mask.sum()) > 0 else 0.0,
                "f1_score": float(f1_score(y_true[mask], y_pred[mask], average="weighted", zero_division=0)) if int(mask.sum()) > 0 else 0.0,
            }
        )
    return rows


def bias_risk_scoring(dp_diff: float, eo_diff: float, pp_diff: float) -> float:
    return float(max(0.0, min(100.0, 100.0 - ((dp_diff * 40.0) + (eo_diff * 35.0) + (pp_diff * 25.0)) * 100.0)))


def sensitive_feature_impact_analysis(x: pd.DataFrame, sensitive_column: str) -> dict[str, Any]:
    if sensitive_column not in x.columns:
        return {"sensitive_column": sensitive_column, "available": False}
    vc = x[sensitive_column].value_counts(normalize=True).to_dict()
    return {"sensitive_column": sensitive_column, "available": True, "distribution": vc}


def bias_alert_generation(bias_score: float) -> list[str]:
    alerts = []
    if bias_score < 50:
        alerts.append("High fairness risk detected")
    elif bias_score < 70:
        alerts.append("Moderate fairness risk detected")
    return alerts


def fairness_compliance_summary(bias_score: float, threshold: float = 70.0) -> dict[str, Any]:
    return {"compliant": bias_score >= threshold, "threshold": threshold, "score": bias_score}


# PART 6 - DRIFT DETECTION ENGINE
def kl_divergence(expected: np.ndarray, actual: np.ndarray, eps: float = 1e-6) -> float:
    p = np.asarray(expected, dtype=float) + eps
    q = np.asarray(actual, dtype=float) + eps
    p = p / p.sum()
    q = q / q.sum()
    return float(np.sum(p * np.log(p / q)))


def psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    exp = pd.to_numeric(expected, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    cur = pd.to_numeric(actual, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if exp.empty or cur.empty:
        return 0.0
    cuts = np.percentile(exp, np.linspace(0, 100, bins + 1))
    cuts = np.unique(cuts)
    if len(cuts) < 3:
        return 0.0
    exp_hist = np.histogram(exp, cuts)[0] / max(len(exp), 1)
    cur_hist = np.histogram(cur, cuts)[0] / max(len(cur), 1)
    exp_hist = np.where(exp_hist == 0, 1e-6, exp_hist)
    cur_hist = np.where(cur_hist == 0, 1e-6, cur_hist)
    return float(np.sum((cur_hist - exp_hist) * np.log(cur_hist / exp_hist)))


def feature_drift_detection(baseline_df: pd.DataFrame, current_df: pd.DataFrame) -> list[dict[str, Any]]:
    shared = [c for c in baseline_df.columns if c in current_df.columns]
    rows = []
    for col in shared:
        score = psi(baseline_df[col], current_df[col])
        rows.append({"feature": col, "psi": float(score), "drifted": bool(score > 0.2)})
    return rows


def output_drift_detection(baseline_pred: np.ndarray, current_pred: np.ndarray) -> dict[str, Any]:
    b = pd.Series(baseline_pred).value_counts(normalize=True).sort_index()
    c = pd.Series(current_pred).value_counts(normalize=True).sort_index()
    idx = b.index.union(c.index)
    score = kl_divergence(b.reindex(idx, fill_value=1e-6).to_numpy(), c.reindex(idx, fill_value=1e-6).to_numpy())
    return {"output_kl_divergence": score, "drifted": score > 0.1}


def drift_severity_scoring(feature_rows: list[dict[str, Any]], output_kl: float) -> float:
    feature_risk = float(np.mean([min(1.0, float(r["psi"])) for r in feature_rows])) if feature_rows else 0.0
    risk = (feature_risk * 70.0) + (min(1.0, output_kl) * 30.0)
    return float(max(0.0, min(100.0, risk * 100.0)))


def drift_alert_trigger(severity_score: float) -> bool:
    return severity_score >= 60.0


# PART 7 - TRUST SCORING SYSTEM
@dataclass
class TrustWeights:
    performance: float = 0.30
    explainability: float = 0.20
    fairness: float = 0.20
    drift_safety: float = 0.15
    stability: float = 0.15


def compute_trust_score(
    performance_score: float,
    explainability_score: float,
    fairness_score: float,
    drift_risk_score: float,
    stability_score: float,
    weights: TrustWeights | None = None,
) -> dict[str, Any]:
    w = weights or TrustWeights()
    drift_safety = max(0.0, min(100.0, 100.0 - drift_risk_score))
    trust = (
        w.performance * performance_score
        + w.explainability * explainability_score
        + w.fairness * fairness_score
        + w.drift_safety * drift_safety
        + w.stability * stability_score
    )
    trust = float(max(0.0, min(100.0, trust)))
    if trust < 40:
        level = "CRITICAL RISK"
    elif trust < 60:
        level = "LOW"
    elif trust < 80:
        level = "MODERATE"
    else:
        level = "HIGH"
    return {
        "trust_score": round(trust, 2),
        "trust_level": level,
        "components": {
            "performance_score": performance_score,
            "explainability_score": explainability_score,
            "fairness_score": fairness_score,
            "drift_risk_score": drift_risk_score,
            "stability_score": stability_score,
        },
        "weights": w.__dict__,
    }


# PART 8 - AUDIT & LOGGING SYSTEM
def build_audit_event(
    tenant_id: str, actor_uid: str, action: str, resource_type: str, resource_id: str, metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "actor_uid": actor_uid,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": metadata or {},
        "created_at": utc_now(),
    }


def version_history_record(resource_id: str, version: str, checksum: str, changed_by: str) -> dict[str, Any]:
    return {"resource_id": resource_id, "version": version, "checksum": checksum, "changed_by": changed_by, "timestamp": utc_now()}


def generate_audit_trail_report(events: list[dict[str, Any]]) -> dict[str, Any]:
    return {"generated_at": utc_now(), "total_events": len(events), "events": events}


# PART 9 - GOVERNANCE REPORT GENERATOR
def generate_governance_report_payload(
    model_risk_summary: dict[str, Any],
    bias_summary: dict[str, Any],
    explainability_summary: dict[str, Any],
    compliance_checklist: list[dict[str, Any]],
    recommendations: list[str],
) -> dict[str, Any]:
    return {
        "generated_at": utc_now(),
        "executive_summary": {
            "overall_risk_level": model_risk_summary.get("risk_level"),
            "trust_score": model_risk_summary.get("trust_score"),
            "bias_score": bias_summary.get("bias_score"),
        },
        "model_risk_summary": model_risk_summary,
        "bias_analysis_summary": bias_summary,
        "explainability_summary": explainability_summary,
        "compliance_checklist": compliance_checklist,
        "risk_recommendations": recommendations,
    }


# PART 11 - SECURITY & VALIDATION
def file_validation(filename: str, content: bytes, allowed_ext: tuple[str, ...], max_mb: int) -> tuple[bool, str]:
    if not filename.lower().endswith(allowed_ext):
        return False, f"Unsupported file extension. Allowed: {allowed_ext}"
    if len(content) > max_mb * 1024 * 1024:
        return False, f"File exceeds {max_mb} MB limit"
    return True, "valid"


def malicious_file_detection(content: bytes) -> tuple[bool, str]:
    signatures = [b"__import__('os').system", b"subprocess.Popen", b"eval("]
    lowered = content.lower()
    for sig in signatures:
        if sig.lower() in lowered:
            return False, "Potentially malicious payload pattern detected"
    return True, "clean"


def environment_variable_validation(required: list[str], env: dict[str, str | None]) -> tuple[bool, list[str]]:
    missing = [key for key in required if not env.get(key)]
    return len(missing) == 0, missing
