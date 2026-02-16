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
COPY models /app/models
COPY reports /app/reports

RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir -e .

# Models are baked into the image via COPY above.
EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn spi_api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
