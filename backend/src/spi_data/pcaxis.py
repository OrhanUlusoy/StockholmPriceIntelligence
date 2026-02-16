from __future__ import annotations

import re
from itertools import product

import pandas as pd

_KV_RE = re.compile(r"^\s*([A-Z\-]+)(?:\(\"([^\"]+)\"\))?\s*=\s*(.*);\s*$")


def _parse_list(value: str) -> list[str]:
    # Parses a PC-Axis list like: "A","B","C" (optionally spanning commas)
    items = re.findall(r"\"((?:[^\"]|\\\")*)\"", value)
    return [i.replace("\\\"", '"') for i in items]


def _parse_dims(meta: dict) -> tuple[list[str], list[str]]:
    stub = _parse_list(meta.get("STUB", "")) if "STUB" in meta else []
    heading = _parse_list(meta.get("HEADING", "")) if "HEADING" in meta else []
    if not stub and not heading:
        raise ValueError("PC-Axis missing STUB/HEADING")
    return stub, heading


def _dim_labels(meta: dict, dim: str) -> list[str] | None:
    # Prefer VALUES over CODES (labels are nicer)
    # meta keys are stored as e.g. VALUES|Region in loader below
    return meta.get(f"VALUES|{dim}")


def _dim_codes(meta: dict, dim: str) -> list[str] | None:
    return meta.get(f"CODES|{dim}")


def pcaxis_to_frame(px_text: str, *, value_col: str = "value") -> pd.DataFrame:
    # Split header and data
    if "DATA=" not in px_text:
        raise ValueError("PC-Axis missing DATA=")

    header_text, data_text = px_text.split("DATA=", 1)
    meta: dict[str, object] = {}

    for raw_line in header_text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("!"):
            continue
        m = _KV_RE.match(line)
        if not m:
            continue
        base, dim, rhs = m.group(1), m.group(2), m.group(3)
        base = base.strip()
        rhs = rhs.strip()

        if base in {"STUB", "HEADING"}:
            meta[base] = rhs
            continue

        if base in {"CODES", "VALUES"} and dim:
            meta[f"{base}|{dim}"] = _parse_list(rhs)
            continue

        # store other scalar-ish metadata
        meta[base if not dim else f"{base}|{dim}"] = rhs

    stub_dims, heading_dims = _parse_dims(meta)  # type: ignore[arg-type]
    dims = stub_dims + heading_dims

    dim_members: list[list[str]] = []
    for dim in dims:
        labels = _dim_labels(meta, dim)
        codes = _dim_codes(meta, dim)
        members = labels or codes
        if not members:
            raise ValueError(f"PC-Axis missing VALUES/CODES for dimension '{dim}'")
        dim_members.append([str(x) for x in members])

    # Parse DATA values: whitespace-separated numbers, terminated by ';'
    data_body = data_text.strip()
    if data_body.endswith(";"):
        data_body = data_body[:-1]
    tokens = [t for t in re.split(r"\s+", data_body) if t]

    # Keep numeric tokens; PC-Axis can include '..' for missing
    values: list[float | None] = []
    for t in tokens:
        if t in {"..", ".", "-"}:
            values.append(None)
            continue
        try:
            values.append(float(t.replace(",", ".")))
        except ValueError:
            # Ignore non-numeric garbage
            continue

    # Data ordering: rows (stub combinations) x columns (heading combinations)
    stub_members = dim_members[: len(stub_dims)]
    heading_members = dim_members[len(stub_dims) :]

    row_combos = list(product(*stub_members)) if stub_members else [()]
    col_combos = list(product(*heading_members)) if heading_members else [()]
    expected = len(row_combos) * len(col_combos)
    if len(values) < expected:
        raise ValueError(f"PC-Axis has {len(values)} values, expected {expected}")

    rows = []
    idx = 0
    for row in row_combos:
        for col in col_combos:
            coord = list(row) + list(col)
            rows.append({dim: coord[i] for i, dim in enumerate(dims)} | {value_col: values[idx]})
            idx += 1

    return pd.DataFrame(rows)
