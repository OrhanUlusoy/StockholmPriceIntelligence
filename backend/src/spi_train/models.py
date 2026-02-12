from __future__ import annotations

from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression

from spi_train.config import ModelSpec


def build_model(spec: ModelSpec, *, random_state: int):
    t = spec.type
    p = dict(spec.params)

    if t == "linear":
        return LinearRegression()
    if t == "random_forest":
        return RandomForestRegressor(random_state=random_state, **p)
    if t == "hist_gradient_boosting":
        # HistGradientBoostingRegressor uses random_state
        return HistGradientBoostingRegressor(random_state=random_state, **p)

    raise ValueError(f"Unknown model type: {t}")
