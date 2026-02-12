from __future__ import annotations

import json
import os
from datetime import datetime, timezone


def append_jsonl(log_path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
