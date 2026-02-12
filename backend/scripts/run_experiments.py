from __future__ import annotations

import argparse
from pathlib import Path

from spi_train.config import load_params
from spi_train.training import train_and_evaluate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", default="params.json")
    parser.add_argument("--model", default="baseline")
    parser.add_argument("--version", default="v1")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    params = load_params(repo_root / args.params)
    run, model_path, pre_path = train_and_evaluate(
        params=params,
        model_name=args.model,
        repo_root=repo_root,
        version_tag=args.version,
    )

    print(f"model={run.model_name} type={run.model_type}")
    print(f"MAE={run.mean_mae:.2f} RMSE={run.mean_rmse:.2f} R2={run.mean_r2:.4f}")
    print(f"Saved: {model_path}")
    print(f"Saved: {pre_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
