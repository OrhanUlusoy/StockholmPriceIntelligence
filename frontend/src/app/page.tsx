"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type PredictRequest = {
  area: number;
  rooms: number;
  district: string;
  year_built: number;
  monthly_fee: number;
  transaction_year?: number | null;
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

function toNumber(input: string): number {
  return Number(input.replace(",", "."));
}

function rangeInt(min: number, max: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += 1) out.push(v);
  return out;
}

function rangeStep(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export default function Home() {
  const apiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
    [],
  );

  const selectClassName =
    "w-full rounded-md border border-slate-700 px-3 py-2 bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/40";

  const defaultTransactionYear = Math.min(new Date().getFullYear(), 2024);

  const areaOptions = useMemo(() => rangeStep(20, 300, 5), []);
  const roomOptions = useMemo(() => rangeStep(1, 10, 0.5), []);
  const yearBuiltOptions = useMemo(() => rangeInt(1850, 2024).reverse(), []);
  const transactionYearOptions = useMemo(
    () => rangeInt(2000, 2024).reverse(),
    [],
  );
  const monthlyFeeOptions = useMemo(() => {
    const base = rangeInt(0, 20000).filter((v) => v % 250 === 0);
    return base;
  }, []);
  const districtOptions = useMemo(
    () =>
      Array.from(
        new Set([
          "Stockholms län",
          "Stockholm",
          "Södermalm",
          "Vasastan",
          "Östermalm",
          "Kungsholmen",
          "Norrmalm",
          "Bromma",
          "Hägersten-Liljeholmen",
          "Enskede-Årsta-Vantör",
          "Farsta",
          "Skärholmen",
          "Spånga-Tensta",
          "Rinkeby-Kista",
          "Älvsjö",
          "Skarpnäck",
          "Solna",
          "Sundbyberg",
          "Nacka",
          "Lidingö",
          "Täby",
          "Danderyd",
          "Järfälla",
          "Sollentuna",
          "Upplands Väsby",
          "Vallentuna",
          "Värmdö",
          "Tyresö",
          "Haninge",
          "Huddinge",
          "Botkyrka",
          "Salem",
          "Ekerö",
          "Sigtuna",
          "Nynäshamn",
          "Vaxholm",
          "Österåker",
        ]),
      ),
    [],
  );

  const [form, setForm] = useState<PredictRequest>({
    area: 65,
    rooms: 2,
    district: "Södermalm",
    year_built: 1998,
    monthly_fee: 3200,
    transaction_year: defaultTransactionYear,
  });
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateForm(patch: Partial<PredictRequest>) {
    setForm((s) => ({ ...s, ...patch }));
    setResult(null);
    setError(null);
  }

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
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950" />
      <div
        className="pointer-events-none absolute inset-0 text-cyan-400/30 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 84px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 84px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 text-fuchsia-500/25 opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 120px)",
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative p-8 sm:p-12">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
                Stockholm Price Intelligence
              </span>
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Uppskatta pris per kvm och totalpris för bostadsrätt.
            </p>
          </header>

          <main className="space-y-6">
            <form
              onSubmit={onSubmit}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur"
            >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <div className="text-sm font-medium">Boarea (kvm)</div>
                <select
                  className={selectClassName}
                  value={String(form.area)}
                  onChange={(e) => updateForm({ area: toNumber(e.target.value) })}
                  required
                >
                  {areaOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Antal rum</div>
                <select
                  className={selectClassName}
                  value={String(form.rooms)}
                  onChange={(e) => updateForm({ rooms: toNumber(e.target.value) })}
                  required
                >
                  {roomOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {String(v).replace(".", ",")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Stadsdel / ort</div>
                <select
                  className={selectClassName}
                  value={form.district}
                  onChange={(e) => updateForm({ district: e.target.value })}
                  required
                >
                  {districtOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Byggår</div>
                <select
                  className={selectClassName}
                  value={String(form.year_built)}
                  onChange={(e) => updateForm({ year_built: toNumber(e.target.value) })}
                  required
                >
                  {yearBuiltOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">Transaktionsår</div>
                <select
                  className={selectClassName}
                  value={String(form.transaction_year ?? "")}
                  onChange={(e) =>
                    updateForm({
                      transaction_year:
                        e.target.value === "" ? null : Math.trunc(toNumber(e.target.value)),
                    })
                  }
                  required
                >
                  {transactionYearOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm font-medium">Avgift (kr/mån)</div>
                <select
                  className={selectClassName}
                  value={String(form.monthly_fee)}
                  onChange={(e) => updateForm({ monthly_fee: toNumber(e.target.value) })}
                  required
                >
                  {monthlyFeeOptions.map((v) => (
                    <option key={v} value={v} className="bg-slate-950 text-slate-100">
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                >
                  {loading ? "Beräknar…" : "Predict"}
                </button>
                <div className="text-xs text-slate-300">
                  API: <span className="font-mono">{apiBaseUrl}</span>
                </div>
              </div>
            </form>

          {error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-300">Pris per kvm</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {formatSek(result.predicted_price_per_sqm)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-300">Totalpris</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {formatSek(result.predicted_total_price)}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-300">
                model={result.model_version} · inference={result.inference_ms.toFixed(1)}ms
              </div>
            </div>
          )}
          </main>
        </div>
      </div>
    </div>
  );
}
