from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class PreparedPaths:
    processed_csv: Path
    summary_json: Path


CANONICAL_COLS = [
    "area",
    "rooms",
    "district",
    "year_built",
    "monthly_fee",
    "transaction_year",
    "price_per_sqm",
]


def _invert_map(column_map: dict[str, str]) -> dict[str, str]:
    # column_map: canonical -> raw
    inv: dict[str, str] = {}
    for canonical, raw in column_map.items():
        if not raw:
            continue
        inv[str(raw)] = str(canonical)
    return inv


def _coerce_numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    out = df.copy()
    for c in cols:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce")
    return out


def prepare_dataset(
    *,
    raw_csv: Path,
    processed_csv: Path,
    summary_json: Path,
    column_map: dict[str, str] | None = None,
    required_features: list[str] | None = None,
    target_col: str = "price_per_sqm",
    target_scale: float = 1.0,
) -> PreparedPaths:
    if not raw_csv.exists():
        raise FileNotFoundError(f"Raw CSV not found: {raw_csv}")

    processed_csv.parent.mkdir(parents=True, exist_ok=True)
    summary_json.parent.mkdir(parents=True, exist_ok=True)

    df_raw = pd.read_csv(raw_csv)
    col_map = column_map or {}

    # Rename raw columns to canonical names when mapping provided
    inv = _invert_map(col_map)
    df = df_raw.rename(columns=inv)

    # Derive transaction_year from transaction_date if needed
    if "transaction_year" not in df.columns and "transaction_date" in df.columns:
        dt = pd.to_datetime(df["transaction_date"], errors="coerce")
        df["transaction_year"] = dt.dt.year

    # Compute target (default: price_per_sqm) if needed and possible
    if target_col == "price_per_sqm" and "price_per_sqm" not in df.columns:
        if "total_price" in df.columns and "area" in df.columns:
            area = pd.to_numeric(df["area"], errors="coerce")
            total = pd.to_numeric(df["total_price"], errors="coerce")
            df["price_per_sqm"] = total / area

    # Keep only canonical columns that exist (plus any canonical extras we might have computed)
    keep = [c for c in CANONICAL_COLS if c in df.columns]
    if target_col in df.columns and target_col not in keep:
        keep.append(target_col)
    df = df[keep].copy()

    # Enforce required columns: target + any configured features
    required = list(dict.fromkeys([target_col] + (required_features or [])))
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            "Processed dataset is missing required canonical columns: "
            f"{missing}. Update params.json:data.column_map to map "
            "your raw columns and/or adjust feature list."
        )

    if "district" in df.columns:
        df["district"] = df["district"].astype(str).fillna("Unknown")
    df = _coerce_numeric(
        df,
        ["area", "rooms", "year_built", "monthly_fee", "transaction_year", "price_per_sqm"],
    )

    # Basic row filtering: need target, and area if present
    df = df.replace([np.inf, -np.inf], np.nan)
    if "area" in df.columns:
        df = df[df["area"].notna() & (df["area"] > 0)]
    df = df[df[target_col].notna() & (df[target_col] > 0)]

    if target_scale != 1.0 and target_col in df.columns:
        df[target_col] = pd.to_numeric(df[target_col], errors="coerce") * float(target_scale)

    df.to_csv(processed_csv, index=False)

    missing_pct = (
        (df.isna().mean() * 100.0)
        .round(2)
        .sort_values(ascending=False)
        .to_dict()
    )

    summary = {
        "raw_csv": str(raw_csv),
        "processed_csv": str(processed_csv),
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "columns": list(df.columns),
        "missing_pct": missing_pct,
    }
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    return PreparedPaths(processed_csv=processed_csv, summary_json=summary_json)
