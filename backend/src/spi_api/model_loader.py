from __future__ import annotations

import os
from dataclasses import dataclass

import joblib


@dataclass(frozen=True)
class LoadedArtifacts:
    preprocessor: object
    model: object
    model_version: str


def load_artifacts() -> LoadedArtifacts:
    model_path = os.getenv("MODEL_PATH", "models/model_v1.pkl")
    preprocessor_path = os.getenv("PREPROCESSOR_PATH", "models/preprocessor_v1.pkl")
    model_version = os.getenv("MODEL_VERSION", "v1")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model artifact not found at '{model_path}'. Run training to create it."
        )
    if not os.path.exists(preprocessor_path):
        raise FileNotFoundError(
            f"Preprocessor artifact not found at '{preprocessor_path}'. Run training to create it."
        )

    model = joblib.load(model_path)
    preprocessor = joblib.load(preprocessor_path)

    return LoadedArtifacts(preprocessor=preprocessor, model=model, model_version=model_version)
