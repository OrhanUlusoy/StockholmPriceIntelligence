# Stockholm Price Intelligence

Predicts Stockholm apartment (bostadsrätt) market value using structured housing features.

**Target**: price per square meter (SEK/kvm) + derived total price.

## Features
- Reproducible training via `params.json` + saved artifacts (`backend/models/*.pkl`)
- Experiment logging to JSON (`backend/reports/metrics/*.json`)
- FastAPI inference service (`POST /predict`) with latency logging (JSONL)
- Next.js + Tailwind single-page UI
- DVC pipeline skeleton for data/model versioning
- GitHub Actions CI: lint/test/build + Docker build

## Quickstart (local)

### 1) Backend: install
From repo root:

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python -m pip install -U pip
./.venv/Scripts/python -m pip install -e .[dev]
```

### 2) Training (example)
This repo includes a synthetic data generator so you can test end-to-end before adding SCB data.

From repo root:

```bash
./.venv/Scripts/python backend/scripts/make_synth_data.py --out data/processed/train.csv --n 3000
./.venv/Scripts/python backend/scripts/run_experiments.py --params params.json --model baseline --version v1
```

Artifacts created:
- `backend/models/model_v1.pkl`
- `backend/models/preprocessor_v1.pkl`

### 3) Run API
From repo root:

```bash
cd backend
./.venv/Scripts/python -m uvicorn spi_api.main:app --host 0.0.0.0 --port 8000
```

#### One-command start (SCB model)
If you want to run the API using the SCB-trained artifacts (sets env vars + starts Uvicorn):

- Git Bash:

```bash
cd backend
./scripts/run_api_scb.sh
```

- PowerShell:

```powershell
cd backend
./scripts/run_api_scb.ps1
```

If port `8000` is already in use, run on a different port:

```powershell
cd backend
$env:PORT = "8001"
./scripts/run_api_scb.ps1
```

To see what's using port 8000 (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object -First 5
```

To stop the owning process (PowerShell):

```powershell
$pid = (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Select-Object -First 1
Stop-Process -Id $pid -Force
```

If PowerShell blocks scripts, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_api_scb.ps1
```

#### Set env vars (Windows shells)
If you're using **Git Bash (MINGW64)**, use `export`:

```bash
cd backend
export MODEL_PATH=models/model_scb_v2.pkl
export PREPROCESSOR_PATH=models/preprocessor_scb_v2.pkl
export MODEL_VERSION=scb_v2
export TARGET_MODE=total_price
./.venv/Scripts/python -m uvicorn spi_api.main:app --host 0.0.0.0 --port 8000
```

If you're using **PowerShell**, use `$env:`:

```powershell
cd backend
$env:MODEL_PATH = "models/model_scb_v2.pkl"
$env:PREPROCESSOR_PATH = "models/preprocessor_scb_v2.pkl"
$env:MODEL_VERSION = "scb_v2"
$env:TARGET_MODE = "total_price"
./.venv/Scripts/python -m uvicorn spi_api.main:app --host 0.0.0.0 --port 8000
```

If you're using **CMD**, use `set`:

```bat
cd backend
set MODEL_PATH=models\model_scb_v2.pkl
set PREPROCESSOR_PATH=models\preprocessor_scb_v2.pkl
set MODEL_VERSION=scb_v2
set TARGET_MODE=total_price
.\.venv\Scripts\python -m uvicorn spi_api.main:app --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

Test predict:

- Git Bash (robust quoting):

```bash
cat <<'JSON' | curl -sS -X POST "http://localhost:8000/predict" -H "Content-Type: application/json" --data-binary @-
{"area":65,"rooms":2,"district":"Stockholms län","year_built":1985,"monthly_fee":3500,"transaction_year":2022}
JSON
```

- PowerShell (recommended; avoids the `curl` alias):

```powershell
$body = @{
	area = 65
	rooms = 2
	district = "Stockholms län"
	year_built = 1985
	monthly_fee = 3500
	transaction_year = 2022
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8000/predict" -ContentType "application/json" -Body $body
```

### 4) Run frontend
From repo root:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Open: `http://localhost:3000`

## API

### `POST /predict`
Request:

```json
{
	"area": 65,
	"rooms": 2,
	"district": "Södermalm",
	"year_built": 1998,
	"monthly_fee": 3200
}
```

Response:

```json
{
	"predicted_price_per_sqm": 72000,
	"predicted_total_price": 4680000,
	"model_version": "v1",
	"inference_ms": 12.3
}
```

Inference logging (default): `backend/logs/predictions.jsonl`

## Experiments
Metrics are logged per run to `backend/reports/metrics/run_*.json` and also written to `backend/reports/metrics/latest.json`.

Example results (synthetic data):

| Model | Version tag | MAE (SEK/kvm) | RMSE (SEK/kvm) | R² |
|---|---:|---:|---:|---:|
| Linear Regression (baseline) | v1 | 3183.93 | 3981.77 | 0.8784 |
| RandomForestRegressor | v2 | 3398.33 | 4237.46 | 0.8625 |
| HistGradientBoostingRegressor | v3 | 3616.34 | 4512.29 | 0.8438 |

## DVC (data/model versioning)
`dvc.yaml` is included as a starting point with two stages:
- `prepare`: `data/raw/*.csv` → `data/processed/train.csv`
- `train`: trains model and writes artifacts/metrics

Install DVC and run:

```bash
dvc init
dvc repro
```

### Supplying SCB data
Put your raw SCB export at `data/raw/scb.csv` (or update `params.json:data.raw_csv`).

Because SCB column names vary between exports, use `params.json:data.column_map` to map your raw columns to the canonical names used in this project:
- `area`, `rooms`, `district`, `year_built`, `monthly_fee`, `transaction_year`
- either provide `price_per_sqm`, or provide `total_price` + `area` (then `price_per_sqm` is computed)

The prepare stage writes a simple profile report to `backend/reports/data/summary.json`.

### Fetching from SCB API (optional)
If you have a PxWeb v2 “tables/TABxxxx/data?...” link, it often returns PC-Axis (`.px`). This repo includes a helper that converts it to CSV:

```bash
python backend/scripts/fetch_scb_api.py --url "<paste your SCB v2 URL here>" --out data/raw/scb.csv
python backend/scripts/prepare_data.py --params params.json
```

For TAB1151 / “Medianpris i tkr”, `params.json:data.target_scale` is set to `1000` so the model learns in SEK.

## Docker (backend)
Dockerfile is in `backend/Dockerfile`.

```bash
docker build -t spi-backend -f backend/Dockerfile backend
docker run -p 8000:8000 -v %cd%/backend/models:/app/models spi-backend
```

## Success criteria
- Primary: MAE (SEK)
- Secondary: RMSE, R²
- Inference latency goal: <200ms per prediction (hardware-dependent)
