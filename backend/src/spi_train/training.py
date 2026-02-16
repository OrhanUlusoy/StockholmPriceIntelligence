from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import joblib
import numpy as np
from sklearn.model_selection import KFold

from spi_train.config import Params
from spi_train.data import load_training_frame, split_xy
from spi_train.metrics import mae, r2, rmse
from spi_train.models import build_model
from spi_train.preprocessing import build_preprocessor, iqr_clip_frame


@dataclass(frozen=True)
class FoldMetrics:
    fold: int
    mae: float
    rmse: float
    r2: float


@dataclass(frozen=True)
class RunMetrics:
    model_name: str
    model_type: str
    started_at_utc: str
    duration_s: float
    cv_folds: int
    fold_metrics: list[FoldMetrics]
    mean_mae: float
    mean_rmse: float
    mean_r2: float


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def train_and_evaluate(
    *,
    params: Params,
    model_name: str,
    repo_root: Path,
    version_tag: str,
) -> tuple[RunMetrics, Path, Path]:
    if model_name not in params.models:
        raise ValueError(f"Unknown model '{model_name}'. Available: {list(params.models.keys())}")

    start = perf_counter()
    df = load_training_frame(params.data, repo_root)

    feature_cols = params.data.numeric_features + params.data.categorical_features
    if params.data.outliers.enabled and params.data.outliers.method == "iqr_clip":
        df = iqr_clip_frame(df, numeric_cols=params.data.numeric_features, k=params.data.outliers.k)

    X, y = split_xy(df, feature_cols=feature_cols, target_col=params.data.target_col)

    cv = KFold(n_splits=params.train.cv_folds, shuffle=True, random_state=params.train.random_state)
    fold_metrics: list[FoldMetrics] = []

    for fold_idx, (train_idx, test_idx) in enumerate(cv.split(X), start=1):
        X_train = X.iloc[train_idx]
        y_train = y.iloc[train_idx]
        X_test = X.iloc[test_idx]
        y_test = y.iloc[test_idx]

        pre = build_preprocessor(
            numeric_features=params.data.numeric_features,
            categorical_features=params.data.categorical_features,
        )
        model = build_model(params.models[model_name], random_state=params.train.random_state)

        X_train_t = pre.fit_transform(X_train)
        model.fit(X_train_t, y_train)
        y_pred = model.predict(pre.transform(X_test))

        fold_metrics.append(
            FoldMetrics(
                fold=fold_idx,
                mae=mae(y_test, y_pred),
                rmse=rmse(y_test, y_pred),
                r2=r2(y_test, y_pred),
            )
        )

    mean_mae = float(np.mean([m.mae for m in fold_metrics]))
    mean_rmse = float(np.mean([m.rmse for m in fold_metrics]))
    mean_r2 = float(np.mean([m.r2 for m in fold_metrics]))

    # Fit on full data and export separate artifacts (preprocessor + model)
    pre_full = build_preprocessor(
        numeric_features=params.data.numeric_features,
        categorical_features=params.data.categorical_features,
    )
    model_full = build_model(params.models[model_name], random_state=params.train.random_state)
    X_full_t = pre_full.fit_transform(X)
    model_full.fit(X_full_t, y)

    artifacts_dir = (repo_root / params.artifacts.dir).resolve()
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_path = artifacts_dir / f"{params.artifacts.model_prefix}{version_tag}.pkl"
    pre_path = artifacts_dir / f"{params.artifacts.preprocessor_prefix}{version_tag}.pkl"
    joblib.dump(model_full, model_path)
    joblib.dump(pre_full, pre_path)

    run = RunMetrics(
        model_name=model_name,
        model_type=params.models[model_name].type,
        started_at_utc=_utc_now(),
        duration_s=float(perf_counter() - start),
        cv_folds=params.train.cv_folds,
        fold_metrics=fold_metrics,
        mean_mae=mean_mae,
        mean_rmse=mean_rmse,
        mean_r2=mean_r2,
    )

    # Also write a machine-readable metrics blob for this run
    reports_dir = (repo_root / params.reports.dir).resolve()
    reports_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    metrics_path = reports_dir / f"run_{run_id}_{model_name}_{version_tag}.json"
    payload = {
        "run": asdict(run),
        "params": {
            "model": params.models[model_name].type,
            "model_params": params.models[model_name].params,
            "data": {
                "train_csv": params.data.train_csv,
                "target_col": params.data.target_col,
                "numeric_features": params.data.numeric_features,
                "categorical_features": params.data.categorical_features,
                "outliers": asdict(params.data.outliers),
            },
            "train": asdict(params.train),
        },
        "artifacts": {
            "model_path": str(model_path.relative_to(repo_root)).replace("\\", "/"),
            "preprocessor_path": str(pre_path.relative_to(repo_root)).replace("\\", "/"),
            "version_tag": version_tag,
        },
        "env": {
            "model_version_env": os.getenv("MODEL_VERSION"),
        },
    }
    metrics_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    latest_path = reports_dir / "latest.json"
    latest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return run, model_path, pre_path
