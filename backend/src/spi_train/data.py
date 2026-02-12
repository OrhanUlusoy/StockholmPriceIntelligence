from __future__ import annotations

from pathlib import Path

import pandas as pd

from spi_train.config import DataConfig


def load_training_frame(data_cfg: DataConfig, repo_root: Path) -> pd.DataFrame:
    csv_path = (repo_root / data_cfg.train_csv).resolve()
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training CSV not found at '{csv_path}'. Put a processed CSV there, or update params.json."  # noqa: E501
        )
    return pd.read_csv(csv_path)


def split_xy(df: pd.DataFrame, *, feature_cols: list[str], target_col: str):
    missing = [c for c in feature_cols + [target_col] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in training data: {missing}")
    X = df[feature_cols].copy()
    y = df[target_col].astype(float)
    return X, y
