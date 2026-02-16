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

$env:MODEL_PATH = "models/model_scb_v2.pkl"
$env:PREPROCESSOR_PATH = "models/preprocessor_scb_v2.pkl"
$env:MODEL_VERSION = "scb_v2"
$env:TARGET_MODE = "total_price"
$env:METRICS_PATH = "reports/metrics/latest.json"

if (-not $env:HOST) { $env:HOST = "0.0.0.0" }
if (-not $env:PORT) { $env:PORT = "8000" }

& $py -c "import spi_api" 2>$null
if ($LASTEXITCODE -ne 0) {
  & $py -m pip install -e .
}

& $py -m uvicorn spi_api.main:app --host $env:HOST --port $env:PORT
