FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=models/model_v1.pkl \
    PREPROCESSOR_PATH=models/preprocessor_v1.pkl \
    MODEL_VERSION=v1 \
    PREDICTION_LOG_PATH=logs/predictions.jsonl

COPY pyproject.toml /app/pyproject.toml
COPY src /app/src

RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir -e .

# Models are expected to be mounted into /app/models (or baked in by the user)
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "spi_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
