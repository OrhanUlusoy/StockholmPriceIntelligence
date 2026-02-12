from __future__ import annotations

from itertools import product

import numpy as np
import pandas as pd


def _get_dataset(payload: dict) -> dict:
    # PxWeb sometimes wraps dataset
    if isinstance(payload, dict) and "dataset" in payload and isinstance(payload["dataset"], dict):
        return payload["dataset"]
    return payload


def jsonstat2_to_frame(payload: dict, *, value_col: str = "value") -> pd.DataFrame:
    ds = _get_dataset(payload)

    dim = ds.get("dimension")
    ids = ds.get("id")
    sizes = ds.get("size")
    values = ds.get("value")

    if not isinstance(dim, dict) or not isinstance(ids, list) or not isinstance(sizes, list):
        raise ValueError("Not a JSON-stat2 dataset (missing dimension/id/size)")
    if values is None:
        raise ValueError("JSON-stat2 dataset missing value")

    # Build ordered category codes for each dimension
    dim_categories: list[list[str]] = []
    for dim_id, dim_size in zip(ids, sizes, strict=True):
        d = dim.get(dim_id, {})
        cat = (d.get("category") or {})
        index = cat.get("index")

        if isinstance(index, list):
            codes = [str(x) for x in index]
        elif isinstance(index, dict):
            # index: code -> position
            codes_by_pos = sorted(((int(pos), str(code)) for code, pos in index.items()), key=lambda x: x[0])
            codes = [code for _, code in codes_by_pos]
        else:
            # fallback: labels keys
            labels = (cat.get("label") or {})
            if isinstance(labels, dict) and labels:
                codes = [str(k) for k in labels.keys()]
            else:
                raise ValueError(f"Cannot read category index for dimension '{dim_id}'")

        if len(codes) != int(dim_size):
            # Be tolerant: trim/pad
            codes = codes[: int(dim_size)]
            if len(codes) < int(dim_size):
                codes = codes + ["Unknown"] * (int(dim_size) - len(codes))

        dim_categories.append(codes)

    expected_len = int(np.prod([int(s) for s in sizes]))
    if len(values) != expected_len:
        raise ValueError(f"Unexpected value length {len(values)} (expected {expected_len})")

    rows = []
    for coords, v in zip(product(*dim_categories), values, strict=True):
        row = {dim_id: coord for dim_id, coord in zip(ids, coords, strict=True)}
        row[value_col] = v
        rows.append(row)

    return pd.DataFrame(rows)
