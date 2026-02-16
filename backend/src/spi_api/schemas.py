from __future__ import annotations

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    area: float = Field(gt=0)
    rooms: float = Field(gt=0)
    district: str = Field(min_length=1)
    year_built: int = Field(ge=1800, le=2100)
    monthly_fee: float = Field(ge=0)
    transaction_year: int | None = Field(default=None, ge=1990, le=2100)


class PredictResponse(BaseModel):
    predicted_price_per_sqm: float
    predicted_total_price: float
    model_version: str
    inference_ms: float


class ModelMetrics(BaseModel):
    mean_mae: float | None = None
    mean_rmse: float | None = None
    mean_r2: float | None = None


class ModelInfoResponse(BaseModel):
    model_version: str
    target_mode: str
    metrics_path: str | None = None
    metrics: ModelMetrics | None = None
