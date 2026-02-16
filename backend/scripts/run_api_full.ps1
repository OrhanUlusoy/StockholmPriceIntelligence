$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $BackendDir

Set-Location $BackendDir

$py = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  $py = Join-Path $RepoRoot ".venv\Scripts\python.exe"
}
if (-not (Test-Path $py)) {
  throw "Could not find python in .venv. Create venv in backend/.venv (recommended) or repo-root/.venv."
}

# Full-feature demo model trained on synthetic data (uses all form fields)
$env:MODEL_PATH = "models/model_full_v1.pkl"
$env:PREPROCESSOR_PATH = "models/preprocessor_full_v1.pkl"
$env:MODEL_VERSION = "full_v1"
$env:TARGET_MODE = "total_price"
$env:METRICS_PATH = "reports/metrics_full/latest.json"

if (-not $env:HOST) { $env:HOST = "0.0.0.0" }
if (-not $env:PORT) { $env:PORT = "8001" }

& $py -c "import spi_api" 2>$null
if ($LASTEXITCODE -ne 0) {
  & $py -m pip install -e .
}

& $py -m uvicorn spi_api.main:app --host $env:HOST --port $env:PORT
