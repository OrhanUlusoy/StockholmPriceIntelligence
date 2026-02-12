from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


def build_preprocessor(*, numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
    num_pipe = Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))])
    cat_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
            ("ohe", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", num_pipe, numeric_features),
            ("cat", cat_pipe, categorical_features),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def iqr_clip_frame(df: pd.DataFrame, numeric_cols: list[str], *, k: float = 1.5) -> pd.DataFrame:
    if not numeric_cols:
        return df
    clipped = df.copy()
    for col in numeric_cols:
        if col not in clipped.columns:
            continue
        s = pd.to_numeric(clipped[col], errors="coerce")
        q1 = np.nanpercentile(s, 25)
        q3 = np.nanpercentile(s, 75)
        iqr = q3 - q1
        if not np.isfinite(iqr) or iqr == 0:
            continue
        lo = q1 - k * iqr
        hi = q3 + k * iqr
        clipped[col] = s.clip(lower=lo, upper=hi)
    return clipped
