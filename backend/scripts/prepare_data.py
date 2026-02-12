from __future__ import annotations

import argparse
import json
from pathlib import Path

from spi_data.prepare import prepare_dataset


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", default="params.json")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    params_path = (repo_root / args.params).resolve()
    params = json.loads(params_path.read_text(encoding="utf-8"))

    data_cfg = params.get("data", {})
    raw_csv = (repo_root / data_cfg.get("raw_csv", "data/raw/scb.csv")).resolve()
    processed_csv = (repo_root / data_cfg.get("train_csv", "data/processed/train.csv")).resolve()
    summary_json = (repo_root / "backend/reports/data/summary.json").resolve()

    column_map = data_cfg.get("column_map", {})
    required_features = list(data_cfg.get("numeric_features", [])) + list(
        data_cfg.get("categorical_features", [])
    )
    target_col = str(data_cfg.get("target_col", "price_per_sqm"))
    target_scale = float(data_cfg.get("target_scale", 1.0))
    prepared = prepare_dataset(
        raw_csv=raw_csv,
        processed_csv=processed_csv,
        summary_json=summary_json,
        column_map=column_map,
        required_features=required_features,
        target_col=target_col,
        target_scale=target_scale,
    )

    print(f"Wrote processed: {prepared.processed_csv}")
    print(f"Wrote summary: {prepared.summary_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
