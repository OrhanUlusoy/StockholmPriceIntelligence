from __future__ import annotations

import argparse
import json
from pathlib import Path

import httpx

from spi_data.pcaxis import pcaxis_to_frame
from spi_data.jsonstat2 import jsonstat2_to_frame


def _ensure_jsonstat2(query: dict) -> dict:
    # PxWeb v1 uses { "query": [...], "response": {"format": "..."} }
    q = dict(query)
    resp = dict(q.get("response") or {})
    resp["format"] = "jsonstat2"
    q["response"] = resp
    return q


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="SCB PxWeb API URL (v1 POST or v2 GET)")
    parser.add_argument(
        "--query",
        default=None,
        help="Optional path to JSON query (downloaded via 'Spara API-fråga (json)') for v1 endpoints",
    )
    parser.add_argument("--out", default="data/raw/scb.csv", help="Output CSV path")
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    query_path = None
    if args.query:
        qp = Path(args.query)
        query_path = (repo_root / qp).resolve() if not qp.is_absolute() else qp
    out_path = (repo_root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=args.timeout) as client:
        if query_path is not None:
            query = json.loads(query_path.read_text(encoding="utf-8"))
            query = _ensure_jsonstat2(query)
            r = client.post(args.url, json=query)
        else:
            r = client.get(args.url)
        r.raise_for_status()

    # v2 endpoints often return PC-Axis (.px) as octet-stream with ISO-8859-1
    content_type = (r.headers.get("content-type") or "").lower()
    if r.content.startswith(b"CHARSET=") or "px" in content_type or "octet-stream" in content_type:
        # Try declared charset; fallback to iso-8859-1
        enc = "iso-8859-1"
        if "charset=" in content_type:
            enc = content_type.split("charset=", 1)[1].split(";", 1)[0].strip()
        text = r.content.decode(enc, errors="replace")
        df = pcaxis_to_frame(text, value_col="value")
    else:
        payload = r.json()
        df = jsonstat2_to_frame(payload, value_col="value")

    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows: {out_path}")
    print(f"Columns: {list(df.columns)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
