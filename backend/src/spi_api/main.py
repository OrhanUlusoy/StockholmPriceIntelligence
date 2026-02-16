from __future__ import annotations

import os
import json
from time import perf_counter
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from spi_api.logging_utils import append_jsonl
from spi_api.model_loader import LoadedArtifacts, load_artifacts
from spi_api.schemas import ModelInfoResponse, ModelMetrics, PredictRequest, PredictResponse


def _row_from_request(req: PredictRequest) -> dict:
    return {
        "area": float(req.area),
        "rooms": float(req.rooms),
        "district": req.district,
        "year_built": int(req.year_built),
        "monthly_fee": float(req.monthly_fee),
        "transaction_year": int(req.transaction_year) if req.transaction_year is not None else None,
    }


def create_app() -> FastAPI:
    artifacts: LoadedArtifacts | None = None

    def _load_metrics(path: str) -> ModelMetrics | None:
        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            run = payload.get("run") if isinstance(payload, dict) else None
            if not isinstance(run, dict):
                return None
            return ModelMetrics(
                mean_mae=run.get("mean_mae"),
                mean_rmse=run.get("mean_rmse"),
                mean_r2=run.get("mean_r2"),
            )
        except FileNotFoundError:
            return None
        except Exception:
            return None

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        nonlocal artifacts
        artifacts = load_artifacts()
        yield

    app = FastAPI(title="Stockholm Price Intelligence", version="0.1.0", lifespan=lifespan)

    raw_cors = os.getenv("CORS_ALLOW_ORIGIN", "*").strip()
    if raw_cors == "*":
        allow_origins = ["*"]
    else:
        allow_origins = [o.strip() for o in raw_cors.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/model-info", response_model=ModelInfoResponse)
    def model_info() -> ModelInfoResponse:
        if artifacts is None:
            raise RuntimeError("Model artifacts not loaded")

        target_mode = os.getenv("TARGET_MODE", "price_per_sqm").strip().lower()
        metrics_path = os.getenv("METRICS_PATH")
        metrics = _load_metrics(metrics_path) if metrics_path else None

        return ModelInfoResponse(
            model_version=artifacts.model_version,
            target_mode=target_mode,
            metrics_path=metrics_path,
            metrics=metrics,
        )

    @app.post("/predict", response_model=PredictResponse)
    def predict(req: PredictRequest) -> PredictResponse:
        if artifacts is None:
            raise RuntimeError("Model artifacts not loaded")

        start = perf_counter()
        row = _row_from_request(req)

        X_df = pd.DataFrame([row])
        X = artifacts.preprocessor.transform(X_df)
        y_pred = artifacts.model.predict(X)
        pred = float(np.asarray(y_pred).reshape(-1)[0])

        target_mode = os.getenv("TARGET_MODE", "price_per_sqm").strip().lower()
        if target_mode == "total_price":
            predicted_total_price = pred
            predicted_price_per_sqm = float(predicted_total_price / float(req.area))
        else:
            predicted_price_per_sqm = pred
            predicted_total_price = float(predicted_price_per_sqm * float(req.area))

        inference_ms = (perf_counter() - start) * 1000.0

        log_path = os.getenv("PREDICTION_LOG_PATH", "logs/predictions.jsonl")
        append_jsonl(
            log_path,
            {
                "request": row,
                "predicted_price_per_sqm": predicted_price_per_sqm,
                "predicted_total_price": predicted_total_price,
                "model_version": artifacts.model_version,
                "inference_ms": inference_ms,
            },
        )

        return PredictResponse(
            predicted_price_per_sqm=predicted_price_per_sqm,
            predicted_total_price=predicted_total_price,
            model_version=artifacts.model_version,
            inference_ms=inference_ms,
        )

    return app


app = create_app()
