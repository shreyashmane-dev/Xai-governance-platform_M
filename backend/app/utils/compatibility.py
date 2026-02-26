from dataclasses import dataclass
import pandas as pd


@dataclass
class CompatibilityResult:
    expected_features: list[str]
    dataset_features: list[str]
    missing_features: list[str]
    extra_features: list[str]

    @property
    def compatible(self) -> bool:
        return len(self.missing_features) == 0


def check_feature_compatibility(
    model_doc: dict,
    dataset_df: pd.DataFrame,
    target_column: str,
    model=None,
) -> CompatibilityResult:
    expected_features = list(model_doc.get("feature_schema") or [])
    if not expected_features and model is not None:
        expected_features = list(getattr(model, "feature_names_in_", []) or [])

    dataset_features = [col for col in dataset_df.columns if col != target_column]
    if not expected_features:
        return CompatibilityResult(
            expected_features=[],
            dataset_features=dataset_features,
            missing_features=[],
            extra_features=[],
        )

    missing = [feature for feature in expected_features if feature not in dataset_features]
    extra = [feature for feature in dataset_features if feature not in expected_features]
    return CompatibilityResult(
        expected_features=expected_features,
        dataset_features=dataset_features,
        missing_features=missing,
        extra_features=extra,
    )
