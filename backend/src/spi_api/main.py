from __future__ import annotations

import os
from time import perf_counter
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from spi_api.logging_utils import append_jsonl
from spi_api.model_loader import LoadedArtifacts, load_artifacts
from spi_api.schemas import PredictRequest, PredictResponse


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

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        nonlocal artifacts
        artifacts = load_artifacts()
        yield

    app = FastAPI(title="Stockholm Price Intelligence", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.getenv("CORS_ALLOW_ORIGIN", "*")],
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

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
