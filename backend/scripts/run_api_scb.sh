#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

cd "$BACKEND_DIR"

PY="$BACKEND_DIR/.venv/Scripts/python.exe"
if [[ ! -x "$PY" ]]; then
  PY="$REPO_ROOT/.venv/Scripts/python.exe"
fi

if [[ ! -x "$PY" ]]; then
  echo "Could not find python in .venv. Create venv in backend/.venv (recommended) or repo-root/.venv." >&2
  exit 1
fi

export MODEL_PATH="models/model_scb_v2.pkl"
export PREPROCESSOR_PATH="models/preprocessor_scb_v2.pkl"
export MODEL_VERSION="scb_v2"
export TARGET_MODE="total_price"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

"$PY" -c "import spi_api" >/dev/null 2>&1 || "$PY" -m pip install -e .

exec "$PY" -m uvicorn spi_api.main:app --host "$HOST" --port "$PORT"
