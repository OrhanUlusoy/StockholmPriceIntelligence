"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type PredictRequest = {
  area: number;
  rooms: number;
  district: string;
  year_built: number;
  monthly_fee: number;
};

type PredictResponse = {
  predicted_price_per_sqm: number;
  predicted_total_price: number;
  model_version: string;
  inference_ms: number;
};

function formatSek(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    [],
  );

  const [form, setForm] = useState<PredictRequest>({
    area: 65,
    rooms: 2,
    district: "Södermalm",
    year_built: 1998,
    monthly_fee: 3200,
  });
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as PredictResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-8 sm:p-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Stockholm Price Intelligence</h1>
          <p className="text-sm text-neutral-600">
            Uppskatta pris per kvm och totalpris för bostadsrätt.
          </p>
        </header>

        <main className="space-y-6">
          <form onSubmit={onSubmit} className="rounded-lg border p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <div className="text-sm font-medium">Boarea (kvm)</div>
                <input
                  type="number"
                  min={1}
                  step={0.1}
                  className="w-full rounded-md border px-3 py-2"
                  value={form.area}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, area: Number(e.target.value) }))
                  }
                  required
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Antal rum</div>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  className="w-full rounded-md border px-3 py-2"
                  value={form.rooms}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, rooms: Number(e.target.value) }))
                  }
                  required
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Stadsdel</div>
                <input
                  type="text"
                  className="w-full rounded-md border px-3 py-2"
                  value={form.district}
                  onChange={(e) => setForm((s) => ({ ...s, district: e.target.value }))}
                  required
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Byggår</div>
                <input
                  type="number"
                  min={1800}
                  max={2100}
                  className="w-full rounded-md border px-3 py-2"
                  value={form.year_built}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, year_built: Number(e.target.value) }))
                  }
                  required
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm font-medium">Avgift (kr/mån)</div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border px-3 py-2"
                  value={form.monthly_fee}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, monthly_fee: Number(e.target.value) }))
                  }
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-60"
            >
              {loading ? "Beräknar…" : "Predict"}
            </button>
            <div className="text-xs text-neutral-600">
              API: <span className="font-mono">{apiBaseUrl}</span>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-neutral-600">Pris per kvm</div>
                  <div className="text-xl font-semibold">
                    {formatSek(result.predicted_price_per_sqm)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-neutral-600">Totalpris</div>
                  <div className="text-xl font-semibold">
                    {formatSek(result.predicted_total_price)}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-neutral-600">
                model={result.model_version} · inference={result.inference_ms.toFixed(1)}ms
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
