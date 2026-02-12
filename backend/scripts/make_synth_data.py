from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/processed/train.csv")
    parser.add_argument("--n", type=int, default=6000)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    out_path = (repo_root / args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(42)
    districts = np.array(["Södermalm", "Kungsholmen", "Vasastan", "Östermalm", "Unknown"])

    area = rng.uniform(20, 140, size=args.n)
    rooms = np.clip(rng.normal(2.5, 1.0, size=args.n), 1, 7)
    year_built = rng.integers(1880, 2024, size=args.n)
    monthly_fee = np.clip(rng.normal(3500, 1200, size=args.n), 500, 12000)
    transaction_year = rng.integers(2012, 2026, size=args.n)
    district = rng.choice(districts, size=args.n, p=[0.28, 0.18, 0.22, 0.22, 0.10])

    base = 45000
    district_premium = {
        "Östermalm": 35000,
        "Södermalm": 20000,
        "Vasastan": 18000,
        "Kungsholmen": 15000,
        "Unknown": 0,
    }
    premium = np.array([district_premium[d] for d in district], dtype=float)
    age_penalty = np.clip((2026 - year_built) * 70, 0, 12000)
    fee_penalty = (monthly_fee - 2500) * 1.2
    year_trend = (transaction_year - 2015) * 900
    noise = rng.normal(0, 4000, size=args.n)

    price_per_sqm = base + premium + year_trend - age_penalty - fee_penalty + noise
    price_per_sqm = np.clip(price_per_sqm, 25000, 140000)

    df = pd.DataFrame(
        {
            "area": area,
            "rooms": rooms,
            "district": district,
            "year_built": year_built,
            "monthly_fee": monthly_fee,
            "transaction_year": transaction_year,
            "price_per_sqm": price_per_sqm,
        }
    )
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
