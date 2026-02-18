from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


@pytest.fixture()
def artifacts_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    model_path = tmp_path / "model.pkl"
    preprocessor_path = tmp_path / "preprocessor.pkl"

    numeric_features = ["area", "rooms", "year_built", "monthly_fee"]
    categorical_features = ["district"]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                    ]
                ),
                numeric_features,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("ohe", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    # Fit on tiny synthetic data
    X_train = pd.DataFrame(
        [
            {
                "area": 50,
                "rooms": 2,
                "district": "Södermalm",
                "year_built": 1990,
                "monthly_fee": 3000,
            },
            {
                "area": 80,
                "rooms": 3,
                "district": "Kungsholmen",
                "year_built": 2005,
                "monthly_fee": 4500,
            },
        ]
    )
    y_train = np.array([70000, 90000], dtype=float)

    X_trans = preprocessor.fit_transform(X_train)
    model = RandomForestRegressor(n_estimators=10, random_state=0)
    model.fit(X_trans, y_train)

    joblib.dump(preprocessor, preprocessor_path)
    joblib.dump(model, model_path)

    monkeypatch.setenv("MODEL_PATH", str(model_path))
    monkeypatch.setenv("PREPROCESSOR_PATH", str(preprocessor_path))
    monkeypatch.setenv("MODEL_VERSION", "test")
    monkeypatch.setenv("PREDICTION_LOG_PATH", str(tmp_path / "predictions.jsonl"))
    return tmp_path


def test_predict_returns_expected_shape(artifacts_dir: Path) -> None:
    from spi_api.main import create_app

    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/predict",
            json={
                "area": 65,
                "rooms": 2,
                "district": "Södermalm",
                "year_built": 1998,
                "monthly_fee": 3200,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "predicted_price_per_sqm" in body
        assert "predicted_total_price" in body
        assert body["model_version"] == "test"
        assert body["predicted_total_price"] == pytest.approx(
            body["predicted_price_per_sqm"] * 65, rel=1e-6
        )


def test_health_ok(artifacts_dir: Path) -> None:
    from spi_api.main import create_app

    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}


def test_model_info_returns_version_and_target_mode(
    artifacts_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from spi_api.main import create_app

    monkeypatch.setenv("TARGET_MODE", "price_per_sqm")
    monkeypatch.setenv("METRICS_PATH", str(artifacts_dir / "does_not_exist.json"))

    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/model-info")
        assert resp.status_code == 200
        body = resp.json()
        assert body["model_version"] == "test"
        assert body["target_mode"] == "price_per_sqm"
        assert body["metrics_path"] is not None
        assert body["metrics"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {
            "area": 0,
            "rooms": 2,
            "district": "Södermalm",
            "year_built": 1998,
            "monthly_fee": 3200,
        },
        {
            "area": 65,
            "rooms": -1,
            "district": "Södermalm",
            "year_built": 1998,
            "monthly_fee": 3200,
        },
        {
            "area": 65,
            "rooms": 2,
            "district": "",
            "year_built": 1998,
            "monthly_fee": 3200,
        },
        {
            "area": 65,
            "rooms": 2,
            "district": "Södermalm",
            "year_built": 1700,
            "monthly_fee": 3200,
        },
    ],
)
def test_predict_validation_errors_return_422(artifacts_dir: Path, payload: dict) -> None:
    from spi_api.main import create_app

    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/predict", json=payload)
        assert resp.status_code == 422


def test_predict_appends_prediction_log(artifacts_dir: Path) -> None:
    from spi_api.main import create_app

    log_path = artifacts_dir / "predictions.jsonl"
    assert not log_path.exists()

    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/predict",
            json={
                "area": 65,
                "rooms": 2,
                "district": "Södermalm",
                "year_built": 1998,
                "monthly_fee": 3200,
            },
        )
        assert resp.status_code == 200

    assert log_path.exists()
    lines = log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    record = json.loads(lines[0])

    assert "ts" in record
    assert record["model_version"] == "test"
    assert "request" in record
    assert record["request"]["district"] == "Södermalm"
    assert "predicted_price_per_sqm" in record
    assert "predicted_total_price" in record
