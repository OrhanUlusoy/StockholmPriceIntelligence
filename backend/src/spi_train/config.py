from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class OutlierConfig:
    enabled: bool
    method: str
    k: float


@dataclass(frozen=True)
class DataConfig:
    train_csv: str
    target_col: str
    numeric_features: list[str]
    categorical_features: list[str]
    outliers: OutlierConfig


@dataclass(frozen=True)
class TrainConfig:
    random_state: int
    cv_folds: int


@dataclass(frozen=True)
class ArtifactsConfig:
    dir: str
    model_prefix: str
    preprocessor_prefix: str


@dataclass(frozen=True)
class ReportsConfig:
    dir: str


@dataclass(frozen=True)
class ModelSpec:
    type: str
    params: dict


@dataclass(frozen=True)
class Params:
    data: DataConfig
    train: TrainConfig
    models: dict[str, ModelSpec]
    artifacts: ArtifactsConfig
    reports: ReportsConfig


def load_params(params_path: str | Path) -> Params:
    p = Path(params_path)
    raw = json.loads(p.read_text(encoding="utf-8"))

    out = raw.get("data", {}).get("outliers", {})
    data_cfg = DataConfig(
        train_csv=raw["data"]["train_csv"],
        target_col=raw["data"]["target_col"],
        numeric_features=list(raw["data"]["numeric_features"]),
        categorical_features=list(raw["data"]["categorical_features"]),
        outliers=OutlierConfig(
            enabled=bool(out.get("enabled", True)),
            method=str(out.get("method", "iqr_clip")),
            k=float(out.get("k", 1.5)),
        ),
    )

    train_cfg = TrainConfig(
        random_state=int(raw.get("train", {}).get("random_state", 42)),
        cv_folds=int(raw.get("train", {}).get("cv_folds", 5)),
    )

    artifacts_cfg = ArtifactsConfig(
        dir=str(raw.get("artifacts", {}).get("dir", "backend/models")),
        model_prefix=str(raw.get("artifacts", {}).get("model_prefix", "model_")),
        preprocessor_prefix=str(
            raw.get("artifacts", {}).get("preprocessor_prefix", "preprocessor_")
        ),
    )
    reports_cfg = ReportsConfig(dir=str(raw.get("reports", {}).get("dir", "backend/reports/metrics")))

    models: dict[str, ModelSpec] = {}
    for name, spec in raw.get("models", {}).items():
        models[name] = ModelSpec(type=str(spec.get("type")), params={k: v for k, v in spec.items() if k != "type"})

    return Params(
        data=data_cfg,
        train=train_cfg,
        models=models,
        artifacts=artifacts_cfg,
        reports=reports_cfg,
    )
