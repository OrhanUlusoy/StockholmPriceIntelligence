"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const PriceTrendChart = dynamic(() => import("./PriceTrendChart"), {
  ssr: false,
});

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

type ModelInfoResponse = {
  model_version: string;
  target_mode: string;
  metrics_path?: string | null;
  metrics?: {
    mean_mae?: number | null;
    mean_rmse?: number | null;
    mean_r2?: number | null;
  } | null;
};

type Scenario = {
  id: string;
  created_at: string;
  form: PredictRequest;
  result: PredictResponse;
  asking_price: number | null;
};

type TabKey = "predict" | "compare" | "about";

type Theme = "dark" | "light";

type Language = "sv" | "en";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3 6.8 6.8 0 1 0 21 12.8Z" />
    </svg>
  );
}

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

function toOptionalNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = toNumber(trimmed.replace(/\s+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeFixed(value: number, digits: number): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
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

  const themeStorageKey = "spi_theme_v1";
  const [theme, setTheme] = useState<Theme>("dark");
  const isDark = theme === "dark";

  const languageStorageKey = "spi_language_v1";
  const [language, setLanguage] = useState<Language>("sv");

  const TEXT = useMemo(
    () =>
      ({
        sv: {
          tagline: "Uppskatta pris per kvm och totalpris för bostadsrätt.",

          tabs: { predict: "Prediktera", compare: "Jämför", about: "Om" },

          languageLabel: "Språk",
          languageAria: "Välj språk",

          themeToLightAria: "Byt till ljust tema",
          themeToDarkAria: "Byt till mörkt tema",
          themeLightTitle: "Ljust tema",
          themeDarkTitle: "Mörkt tema",

          labels: {
            area: "Boarea (kvm)",
            rooms: "Antal rum",
            district: "Stadsdel / ort",
            yearBuilt: "Byggår",
            transactionYear: "Transaktionsår",
            monthlyFee: "Avgift (kr/mån)",
            askingPrice: "Utgångspris (kr) (valfritt)",
          },

          placeholders: {
            askingPrice: "t.ex. 4 750 000",
          },

          actions: {
            calculating: "Beräknar…",
            predict: "Prediktera",
            save: "Spara",
            saveTitleEnabled: "Spara scenario",
            saveTitleDisabled: "Prediktera först för att spara",
          },

          meta: {
            apiPrefix: "API:",
          },

          compare: {
            intro: "Välj två sparade scenarion och jämför.",
            scenarioA: "Scenario A",
            scenarioB: "Scenario B",
            choose: "Välj…",
            diffTitle: "Skillnad (A − B)",
            totalPrice: "Totalpris",
            pricePerSqm: "Pris per kvm",
            empty: "Inga sparade scenarion ännu. Gå till Prediktera och tryck Spara.",
          },

          about: {
            heading: "Om projektet",
            description: "Stockholm Price Intelligence är ett end-to-end maskininlärningsprojekt som uppskattar bostadspriser i Stockholmsområdet. Modellen tar hänsyn till boarea, antal rum, stadsdel, byggår, avgift och transaktionsår.",
            techTitle: "Teknikstack",
            techItems: [
              "Modell: Random Forest (scikit-learn)",
              "API: FastAPI (Python)",
              "Frontend: Next.js + React + Tailwind",
              "Deploy: Vercel (frontend) + Render (backend)",
              "CI/CD: GitHub Actions",
            ],
            disclaimer: "Observera: detta är ett demoprojekt — inte en officiell bostadsvärdering.",
            modelLabel: "Modellversion",
          },

          errors: {
            unknown: "Unknown error",
          },

          predictResult: {
            pricePerSqm: "Pris per kvm",
            totalPrice: "Totalpris",
            overUnderTitle: "Över-/undervärderat",
            askingPrice: "Utgångspris",
            classification: "Klassning",
            diff: "Diff",
            bandPrefix: "Band:",
            bandSuffix: "kring modellvärdet",
            undervalued: "Undervärderad",
            overvalued: "Övervärderad",
            fair: "Rimligt prissatt",
          },

          saved: {
            title: "Sparade scenarion",
            clear: "Rensa",
            clearConfirm: "Rensa alla sparade scenarion?",
            setAsA: "Sätt som Scenario A",
            setAsB: "Sätt som Scenario B",
            remove: "Ta bort",
            removeTitle: "Ta bort",
          },

          units: {
            sqm: "kvm",
            rooms: "rum",
          },

          chart: {
            year: "År",
            price: "Estimerat totalpris",
            loading: "Laddar prishistorik…",
          },


        },
        en: {
          tagline: "Estimate price per sqm and total price for condos.",

          tabs: { predict: "Predict", compare: "Compare", about: "About" },

          languageLabel: "Language",
          languageAria: "Select language",

          themeToLightAria: "Switch to light theme",
          themeToDarkAria: "Switch to dark theme",
          themeLightTitle: "Light theme",
          themeDarkTitle: "Dark theme",

          labels: {
            area: "Living area (sqm)",
            rooms: "Rooms",
            district: "District / city",
            yearBuilt: "Year built",
            transactionYear: "Transaction year",
            monthlyFee: "Monthly fee (SEK)",
            askingPrice: "Asking price (SEK) (optional)",
          },

          placeholders: {
            askingPrice: "e.g. 4 750 000",
          },

          actions: {
            calculating: "Calculating…",
            predict: "Predict",
            save: "Save",
            saveTitleEnabled: "Save scenario",
            saveTitleDisabled: "Run Predict first to save",
          },

          meta: {
            apiPrefix: "API:",
          },

          compare: {
            intro: "Pick two saved scenarios and compare.",
            scenarioA: "Scenario A",
            scenarioB: "Scenario B",
            choose: "Choose…",
            diffTitle: "Difference (A − B)",
            totalPrice: "Total price",
            pricePerSqm: "Price per sqm",
            empty: "No saved scenarios yet. Go to Predict and click Save.",
          },

          about: {
            heading: "About the project",
            description: "Stockholm Price Intelligence is an end-to-end machine learning project that estimates apartment prices in the Stockholm area. The model considers living area, number of rooms, district, year built, monthly fee, and transaction year.",
            techTitle: "Tech stack",
            techItems: [
              "Model: Random Forest (scikit-learn)",
              "API: FastAPI (Python)",
              "Frontend: Next.js + React + Tailwind",
              "Deploy: Vercel (frontend) + Render (backend)",
              "CI/CD: GitHub Actions",
            ],
            disclaimer: "Note: this is a demo project — not an official property valuation.",
            modelLabel: "Model version",
          },

          errors: {
            unknown: "Unknown error",
          },

          predictResult: {
            pricePerSqm: "Price per sqm",
            totalPrice: "Total price",
            overUnderTitle: "Over/under valued",
            askingPrice: "Asking price",
            classification: "Classification",
            diff: "Diff",
            bandPrefix: "Band:",
            bandSuffix: "around the model value",
            undervalued: "Undervalued",
            overvalued: "Overvalued",
            fair: "Fairly priced",
          },

          saved: {
            title: "Saved scenarios",
            clear: "Clear",
            clearConfirm: "Clear all saved scenarios?",
            setAsA: "Set as Scenario A",
            setAsB: "Set as Scenario B",
            remove: "Remove",
            removeTitle: "Remove",
          },

          units: {
            sqm: "sqm",
            rooms: "rooms",
          },

          chart: {
            year: "Year",
            price: "Estimated total price",
            loading: "Loading price history…",
          },


        },
      }) as const,
    [],
  );

  const t = TEXT[language];

  const scenariosStorageKey = "spi_scenarios_v1";

  const selectClassName = isDark
    ? "w-full rounded-md border border-slate-700 px-3 py-2 bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    : "w-full rounded-md border border-slate-400 px-3 py-2 bg-slate-50/90 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600/25";

  const inputClassName = isDark
    ? "w-full rounded-md border border-slate-700 px-3 py-2 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    : "w-full rounded-md border border-slate-400 px-3 py-2 bg-slate-50/90 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-600/25";

  const compactSelectClassName = isDark
    ? "h-9 rounded-md border border-slate-700 bg-slate-950/60 px-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
    : "h-9 rounded-md border border-slate-400 bg-slate-50/80 px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-600/25";

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

  const [tab, setTab] = useState<TabKey>("predict");

  const [askingPriceInput, setAskingPriceInput] = useState<string>("");

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [compareAId, setCompareAId] = useState<string>("");
  const [compareBId, setCompareBId] = useState<string>("");

  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [modelInfoError, setModelInfoError] = useState<string | null>(null);
  const [modelInfoLoading, setModelInfoLoading] = useState(false);

  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);



  const askingPrice = useMemo(
    () => toOptionalNumber(askingPriceInput),
    [askingPriceInput],
  );

  const compareA = useMemo(
    () => scenarios.find((s) => s.id === compareAId) ?? null,
    [compareAId, scenarios],
  );
  const compareB = useMemo(
    () => scenarios.find((s) => s.id === compareBId) ?? null,
    [compareBId, scenarios],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(themeStorageKey);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
        return;
      }
    } catch {
      // ignore
    }

    if (typeof window !== "undefined" && "matchMedia" in window) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, [themeStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(languageStorageKey);
      if (stored === "sv" || stored === "en") {
        setLanguage(stored);
        return;
      }
    } catch {
      // ignore
    }

    if (typeof navigator !== "undefined") {
      const raw = (navigator.language ?? "").toLowerCase();
      setLanguage(raw.startsWith("sv") ? "sv" : "en");
    }
  }, [languageStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(languageStorageKey, language);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language, languageStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = theme;
    }
  }, [theme]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(scenariosStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((x): x is Scenario => typeof x === "object" && x !== null)
        .map((s) => s as Scenario)
        .filter((s) =>
          typeof s.id === "string" &&
          typeof s.created_at === "string" &&
          typeof s.form === "object" &&
          typeof s.result === "object",
        );
      setScenarios(normalized);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(scenariosStorageKey, JSON.stringify(scenarios));
    } catch {
      // ignore
    }
  }, [scenarios]);

  useEffect(() => {
    if (tab !== "about") return;

    let cancelled = false;
    async function run() {
      setModelInfoLoading(true);
      setModelInfoError(null);
      try {
        const resp = await fetch(`${apiBaseUrl}/model-info`, { method: "GET" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as ModelInfoResponse;
        if (!cancelled) setModelInfo(data);
      } catch (err) {
        if (!cancelled)
          setModelInfoError(err instanceof Error ? err.message : t.errors.unknown);
      } finally {
        if (!cancelled) setModelInfoLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, tab, t.errors.unknown]);

  function updateForm(patch: Partial<PredictRequest>) {
    setForm((s) => ({ ...s, ...patch }));
    setResult(null);
    setError(null);
  }

  function scenarioTitle(s: Scenario): string {
    const year = s.form.transaction_year ?? "-";
    const rooms = String(s.form.rooms).replace(".", ",");
    return `${s.form.district} · ${s.form.area} ${t.units.sqm} · ${rooms} ${t.units.rooms} · ${year}`;
  }

  function loadScenario(s: Scenario) {
    setForm(s.form);
    setResult(s.result);
    setError(null);
    setLoading(false);
    setAskingPriceInput(s.asking_price == null ? "" : String(Math.trunc(s.asking_price)));
    setTab("predict");
  }

  function deleteScenario(id: string) {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setCompareAId((v) => (v === id ? "" : v));
    setCompareBId((v) => (v === id ? "" : v));
  }

  function saveScenario() {
    if (!result) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    const scenario: Scenario = {
      id,
      created_at: new Date().toISOString(),
      form,
      result,
      asking_price: askingPrice,
    };
    setScenarios((prev) => [scenario, ...prev].slice(0, 50));
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
      setError(err instanceof Error ? err.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }



  return (
    <div
      className={
        isDark
          ? "relative min-h-screen overflow-hidden text-slate-100"
          : "relative min-h-screen overflow-hidden text-slate-900"
      }
    >
      <div
        className={
          isDark
            ? "pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"
            : "pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-200 via-indigo-200 to-slate-300"
        }
      />
      {isDark && (
        <>
          <div
            className="pointer-events-none absolute inset-0 text-fuchsia-500/30 opacity-40 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(860px circle at 92% 38%, currentColor 0%, transparent 62%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 text-white/22 opacity-32 blur-3xl"
            style={{
              backgroundImage:
                "linear-gradient(135deg, currentColor 0%, transparent 58%)",
            }}
          />
        </>
      )}
      {!isDark && (
        <>
          <div
            className="pointer-events-none absolute inset-0 text-cyan-700/18 opacity-16 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(900px circle at 12% 24%, currentColor 0%, transparent 64%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 text-fuchsia-700/14 opacity-14 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(860px circle at 92% 40%, currentColor 0%, transparent 64%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 text-white/55 opacity-10 blur-3xl"
            style={{
              backgroundImage:
                "linear-gradient(135deg, currentColor 0%, transparent 60%)",
            }}
          />
        </>
      )}
      <div
        className={
          isDark
            ? "pointer-events-none absolute inset-0 text-cyan-400/30 opacity-30"
            : "pointer-events-none absolute inset-0 text-cyan-800/30 opacity-28"
        }
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 84px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 84px)",
        }}
      />
      {!isDark && (
        <div
          className="pointer-events-none absolute inset-0 text-cyan-900/35 opacity-22"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 336px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 336px)",
          }}
        />
      )}
      <div
        className={
          isDark
            ? "pointer-events-none absolute inset-0 text-fuchsia-500/25 opacity-25"
            : "pointer-events-none absolute inset-0 text-fuchsia-700/22 opacity-16"
        }
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 120px)",
        }}
      />
      <div
        className={
          isDark
            ? "pointer-events-none absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"
            : "pointer-events-none absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/6 blur-3xl"
        }
      />
      <div
        className={
          isDark
            ? "pointer-events-none absolute -bottom-28 right-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-3xl"
            : "pointer-events-none absolute -bottom-28 right-0 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/6 blur-3xl"
        }
      />

      <div className="relative p-8 sm:p-12">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 text-center">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              <span
                className={
                  isDark
                    ? "bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent"
                    : "bg-gradient-to-r from-cyan-700 to-fuchsia-700 bg-clip-text text-transparent"
                }
              >
                Stockholm Price Intelligence
              </span>
            </h1>

            <p className={isDark ? "mt-2 text-base sm:text-lg leading-relaxed text-slate-300" : "mt-2 text-base sm:text-lg leading-relaxed text-slate-600"}>
              {t.tagline}
            </p>
          </header>

          <main className="space-y-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div />
              <div className="flex items-center justify-center gap-2">
                {([
                  { key: "predict", label: t.tabs.predict },
                  { key: "compare", label: t.tabs.compare },
                  { key: "about", label: t.tabs.about },
                ] as const).map((tabDef) => {
                  const active = tab === tabDef.key;
                  return (
                    <button
                      key={tabDef.key}
                      type="button"
                      onClick={() => setTab(tabDef.key)}
                      className={
                        active
                          ? isDark
                            ? "rounded-md border border-cyan-300/70 bg-gradient-to-r from-cyan-500/20 to-fuchsia-600/20 px-3 py-2 text-sm font-semibold text-slate-50 ring-2 ring-fuchsia-400/25"
                            : "rounded-md border border-cyan-500/50 bg-gradient-to-r from-cyan-500/20 to-fuchsia-600/20 px-3 py-2 text-sm font-semibold text-slate-900 ring-2 ring-fuchsia-500/20"
                          : isDark
                            ? "rounded-md border border-slate-800 bg-slate-950/30 px-3 py-2 text-sm text-slate-300 hover:border-slate-700 hover:bg-slate-950/50"
                            : "rounded-md border border-slate-400 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 hover:border-slate-500 hover:bg-slate-50"
                      }
                    >
                      {tabDef.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <label className="sr-only" htmlFor="language-select">
                  {t.languageLabel}
                </label>
                <select
                  id="language-select"
                  className={compactSelectClassName}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  aria-label={t.languageAria}
                  title={t.languageLabel}
                >
                  <option value="sv">Svenska</option>
                  <option value="en">English</option>
                </select>
                <button
                  type="button"
                  onClick={() => setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"))}
                  className={
                    isDark
                      ? "group relative inline-flex h-9 w-16 items-center rounded-md border border-slate-700 bg-gradient-to-r from-cyan-500/15 via-slate-950/60 to-fuchsia-500/15 px-1 shadow-sm transition-colors hover:border-slate-600"
                      : "group relative inline-flex h-9 w-16 items-center rounded-md border border-slate-400 bg-gradient-to-r from-cyan-500/10 via-slate-50/80 to-fuchsia-500/10 px-1 shadow-sm transition-colors hover:border-slate-500"
                  }
                  aria-label={isDark ? t.themeToLightAria : t.themeToDarkAria}
                  title={isDark ? t.themeLightTitle : t.themeDarkTitle}
                  role="switch"
                  aria-checked={theme === "light"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
                    }
                  }}
                >
                  <span
                    className={
                      isDark
                        ? "pointer-events-none absolute -inset-1 rounded-md bg-gradient-to-r from-cyan-500/35 to-fuchsia-500/35 blur-md opacity-30 transition-opacity group-hover:opacity-55 group-focus-visible:opacity-70"
                        : "pointer-events-none absolute -inset-1 rounded-md bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 blur-md opacity-16 transition-opacity group-hover:opacity-28 group-focus-visible:opacity-36"
                    }
                  />
                  <span
                    className={
                      isDark
                        ? "pointer-events-none absolute left-1 top-1 h-7 w-7 translate-x-0 rounded-md border border-slate-600 bg-slate-900/80 shadow-sm transition-transform duration-200 ease-out"
                        : "pointer-events-none absolute left-1 top-1 h-7 w-7 translate-x-7 rounded-md border border-slate-300 bg-slate-50 shadow-sm transition-transform duration-200 ease-out"
                    }
                  />
                  <span
                    className={
                      isDark
                        ? "pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 text-slate-200"
                        : "pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2 text-slate-700"
                    }
                  >
                    <SunIcon
                      className={
                        isDark
                          ? "h-4 w-4 text-cyan-200"
                          : "h-4 w-4 text-slate-500"
                      }
                    />
                    <MoonIcon
                      className={
                        isDark
                          ? "h-4 w-4 text-slate-500"
                          : "h-4 w-4 text-fuchsia-700"
                      }
                    />
                  </span>
                  <span
                    className={
                      isDark
                        ? "absolute -inset-px rounded-md ring-0 focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "absolute -inset-px rounded-md ring-0 focus-visible:ring-2 focus-visible:ring-cyan-600/25 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-200"
                    }
                  />
                </button>
              </div>
            </div>

            {tab === "predict" && (
            <form
              onSubmit={onSubmit}
              className={
                isDark
                  ? "rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur"
                  : "rounded-xl border border-slate-300 bg-slate-50/80 p-5 backdrop-blur ring-1 ring-slate-200/70"
              }
            >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <div className="text-sm font-medium">{t.labels.area}</div>
                <select
                  className={selectClassName}
                  value={String(form.area)}
                  onChange={(e) => updateForm({ area: toNumber(e.target.value) })}
                  required
                >
                  {areaOptions.map((v) => (
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">{t.labels.rooms}</div>
                <select
                  className={selectClassName}
                  value={String(form.rooms)}
                  onChange={(e) => updateForm({ rooms: toNumber(e.target.value) })}
                  required
                >
                  {roomOptions.map((v) => (
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {String(v).replace(".", ",")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">{t.labels.district}</div>
                <select
                  className={selectClassName}
                  value={form.district}
                  onChange={(e) => updateForm({ district: e.target.value })}
                  required
                >
                  {districtOptions.map((v) => (
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">{t.labels.yearBuilt}</div>
                <select
                  className={selectClassName}
                  value={String(form.year_built)}
                  onChange={(e) => updateForm({ year_built: toNumber(e.target.value) })}
                  required
                >
                  {yearBuiltOptions.map((v) => (
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-sm font-medium">{t.labels.transactionYear}</div>
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
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm font-medium">{t.labels.monthlyFee}</div>
                <select
                  className={selectClassName}
                  value={String(form.monthly_fee)}
                  onChange={(e) => updateForm({ monthly_fee: toNumber(e.target.value) })}
                  required
                >
                  {monthlyFeeOptions.map((v) => (
                    <option
                      key={v}
                      value={v}
                      className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                    >
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <div className="text-sm font-medium">{t.labels.askingPrice}</div>
                <input
                  inputMode="numeric"
                  className={inputClassName}
                  value={askingPriceInput}
                  onChange={(e) => setAskingPriceInput(e.target.value)}
                  placeholder={t.placeholders.askingPrice}
                />
              </label>
            </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-md bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  >
                    {loading ? t.actions.calculating : t.actions.predict}
                  </button>
                  <button
                    type="button"
                    onClick={saveScenario}
                    disabled={!result}
                    className={
                      isDark
                        ? "rounded-md border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
                        : "rounded-md border border-slate-400 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    }
                    title={result ? t.actions.saveTitleEnabled : t.actions.saveTitleDisabled}
                  >
                    {t.actions.save}
                  </button>
                </div>
                <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
                  {t.meta.apiPrefix} <span className="font-mono">{apiBaseUrl}</span>
                </div>
              </div>
            </form>

            )}

            {tab === "compare" && (
              <div
                className={
                  isDark
                    ? "rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur"
                    : "rounded-xl border border-slate-300 bg-slate-50/80 p-5 backdrop-blur ring-1 ring-slate-200/70"
                }
              >
                <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
                  {t.compare.intro}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <div className="text-sm font-medium">{t.compare.scenarioA}</div>
                    <select
                      className={selectClassName}
                      value={compareAId}
                      onChange={(e) => setCompareAId(e.target.value)}
                    >
                      <option
                        value=""
                        className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                      >
                        {t.compare.choose}
                      </option>
                      {scenarios.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                        >
                          {scenarioTitle(s)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <div className="text-sm font-medium">{t.compare.scenarioB}</div>
                    <select
                      className={selectClassName}
                      value={compareBId}
                      onChange={(e) => setCompareBId(e.target.value)}
                    >
                      <option
                        value=""
                        className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                      >
                        {t.compare.choose}
                      </option>
                      {scenarios.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}
                        >
                          {scenarioTitle(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {compareA && compareB && (
                  <div
                    className={
                      isDark
                        ? "mt-5 rounded-lg border border-slate-800 bg-slate-950/40 p-4"
                        : "mt-5 rounded-lg border border-slate-300 bg-slate-50/70 p-4 ring-1 ring-slate-200/60"
                    }
                  >
                    <div className="text-sm font-semibold">{t.compare.diffTitle}</div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{t.compare.totalPrice}</div>
                        <div className="text-xl font-semibold tracking-tight">
                          {formatSek(
                            compareA.result.predicted_total_price -
                              compareB.result.predicted_total_price,
                          )}
                        </div>
                      </div>
                      <div>
                        <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{t.compare.pricePerSqm}</div>
                        <div className="text-xl font-semibold tracking-tight">
                          {formatSek(
                            compareA.result.predicted_price_per_sqm -
                              compareB.result.predicted_price_per_sqm,
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={isDark ? "mt-3 text-sm text-slate-300" : "mt-3 text-sm text-slate-600"}>
                      A: {compareA.result.model_version} · B: {compareB.result.model_version}
                    </div>
                  </div>
                )}

                {scenarios.length === 0 && (
                  <div className={isDark ? "mt-4 text-sm text-slate-300" : "mt-4 text-sm text-slate-600"}>
                    {t.compare.empty}
                  </div>
                )}
              </div>
            )}

            {tab === "about" && (
              <div
                className={
                  isDark
                    ? "rounded-xl border border-slate-800 bg-slate-950/60 p-6 backdrop-blur space-y-5"
                    : "rounded-xl border border-slate-300 bg-slate-50/80 p-6 backdrop-blur ring-1 ring-slate-200/70 space-y-5"
                }
              >
                <h2
                  className={
                    isDark
                      ? "text-lg font-semibold bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent"
                      : "text-lg font-semibold bg-gradient-to-r from-cyan-700 to-fuchsia-700 bg-clip-text text-transparent"
                  }
                >
                  {t.about.heading}
                </h2>

                <p className={isDark ? "text-sm leading-relaxed text-slate-300" : "text-sm leading-relaxed text-slate-600"}>
                  {t.about.description}
                </p>

                <div>
                  <div className="text-sm font-semibold mb-2">{t.about.techTitle}</div>
                  <ul className={isDark ? "space-y-1 text-sm text-slate-300" : "space-y-1 text-sm text-slate-600"}>
                    {t.about.techItems.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={isDark ? "text-cyan-400 mt-0.5" : "text-cyan-600 mt-0.5"}>&#x25B8;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {modelInfo && (
                  <div className={isDark ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                    {t.about.modelLabel}: <span className="font-mono">{modelInfo.model_version}</span>
                  </div>
                )}

                <div
                  className={
                    isDark
                      ? "rounded-lg border border-amber-500/20 bg-amber-950/10 px-4 py-3 text-xs text-amber-200/80"
                      : "rounded-lg border border-amber-400/40 bg-amber-50/80 px-4 py-3 text-xs text-amber-800"
                  }
                >
                  {t.about.disclaimer}
                </div>
              </div>
            )}

          {error && (
            <div
              className={
                isDark
                  ? "rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200"
                  : "rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
              }
            >
              {error}
            </div>
          )}

          {tab === "predict" && result && (
            <div
              className={
                isDark
                  ? "rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur"
                  : "rounded-xl border border-slate-300 bg-slate-50/80 p-5 backdrop-blur ring-1 ring-slate-200/70"
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{t.predictResult.pricePerSqm}</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {formatSek(result.predicted_price_per_sqm)}
                  </div>
                </div>
                <div>
                  <div className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{t.predictResult.totalPrice}</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {formatSek(result.predicted_total_price)}
                  </div>
                </div>
              </div>

              {askingPrice != null && (() => {
                const modelValue = result.predicted_total_price;
                const band = 0.07;
                const low = modelValue * (1 - band);
                const high = modelValue * (1 + band);
                const diff = askingPrice - modelValue;
                const diffPct = (diff / modelValue) * 100;
                const isUnder = askingPrice < low;
                const isOver = askingPrice > high;
                const label = isUnder
                  ? t.predictResult.undervalued
                  : isOver
                    ? t.predictResult.overvalued
                    : t.predictResult.fair;
                const badgeColor = isUnder
                  ? "from-emerald-500 to-cyan-500"
                  : isOver
                    ? "from-rose-500 to-fuchsia-500"
                    : "from-amber-400 to-yellow-500";
                const badgeTextColor = isUnder
                  ? "text-emerald-950"
                  : isOver
                    ? "text-rose-950"
                    : "text-amber-950";
                const barColor = isUnder
                  ? isDark ? "bg-emerald-400" : "bg-emerald-500"
                  : isOver
                    ? isDark ? "bg-rose-400" : "bg-rose-500"
                    : isDark ? "bg-amber-400" : "bg-amber-500";
                const barPct = Math.min(Math.abs(diffPct), 100);
                return (
                  <div
                    className={
                      isDark
                        ? "mt-5 rounded-lg border border-slate-700 bg-slate-900/70 p-4 shadow-md shadow-black/30"
                        : "mt-5 rounded-lg border border-slate-300 bg-white/60 p-4 shadow-md shadow-slate-300/40 ring-1 ring-slate-200/50"
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full bg-gradient-to-r ${badgeColor} px-3 py-1 text-xs font-bold ${badgeTextColor} shadow-sm`}
                      >
                        {isUnder ? "↓" : isOver ? "↑" : "≈"} {label}
                      </span>
                      <span className={isDark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
                        {formatSek(diff)} ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>{t.predictResult.askingPrice}: {formatSek(askingPrice)}</span>
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>{t.predictResult.bandPrefix} ±{Math.round(band * 100)}% {t.predictResult.bandSuffix}</span>
                      </div>
                      <div className={`mt-1.5 h-2 w-full rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                        <div
                          className={`h-2 rounded-full ${barColor} transition-all duration-700 ease-out`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className={isDark ? "mt-4 text-sm text-slate-300" : "mt-4 text-sm text-slate-600"}>
                model={result.model_version} · inference={result.inference_ms.toFixed(1)}ms
              </div>
            </div>
          )}

          {tab === "predict" && result && (
            <PriceTrendChart
              apiBaseUrl={apiBaseUrl}
              form={form}
              highlightYear={form.transaction_year ?? null}
              isDark={isDark}
              labelYear={t.chart.year}
              labelPrice={t.chart.price}
              labelLoading={t.chart.loading}
              formatSek={formatSek}
            />
          )}

          {tab === "predict" && scenarios.length > 0 && (
            <div
              className={
                isDark
                  ? "rounded-xl border border-slate-800 bg-slate-950/60 p-5 backdrop-blur"
                  : "rounded-xl border border-slate-300 bg-slate-50/80 p-5 backdrop-blur ring-1 ring-slate-200/70"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{t.saved.title}</div>
                <button
                  type="button"
                  className={
                    isDark
                      ? "text-sm text-slate-300 hover:text-slate-100"
                      : "text-sm text-slate-600 hover:text-slate-900"
                  }
                  onClick={() => {
                    if (confirm(t.saved.clearConfirm)) {
                      setScenarios([]);
                      setCompareAId("");
                      setCompareBId("");
                    }
                  }}
                >
                  {t.saved.clear}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {scenarios.map((s) => (
                  <div
                    key={s.id}
                    className={
                      isDark
                        ? "flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                        : "flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-2 ring-1 ring-slate-200/60"
                    }
                  >
                    <button
                      type="button"
                      className={
                        isDark
                          ? "text-left text-sm text-slate-100 hover:underline"
                          : "text-left text-sm text-slate-900 hover:underline"
                      }
                      onClick={() => loadScenario(s)}
                    >
                      {scenarioTitle(s)}
                      <div className={isDark ? "mt-1 text-sm text-slate-300" : "mt-1 text-sm text-slate-600"}>
                        {formatSek(s.result.predicted_total_price)} · {s.result.model_version}
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={
                          isDark
                            ? "rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-100"
                            : "rounded-md border border-slate-400 bg-slate-50/80 px-2 py-1 text-sm text-slate-900"
                        }
                        onClick={() => {
                          setCompareAId(s.id);
                          setTab("compare");
                        }}
                        title={t.saved.setAsA}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        className={
                          isDark
                            ? "rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-sm text-slate-100"
                            : "rounded-md border border-slate-400 bg-slate-50/80 px-2 py-1 text-sm text-slate-900"
                        }
                        onClick={() => {
                          setCompareBId(s.id);
                          setTab("compare");
                        }}
                        title={t.saved.setAsB}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className={
                          isDark
                            ? "text-sm text-slate-300 hover:text-slate-100"
                            : "text-sm text-slate-600 hover:text-slate-900"
                        }
                        onClick={() => deleteScenario(s.id)}
                        title={t.saved.removeTitle}
                      >
                        {t.saved.remove}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </main>
        </div>

        <footer className="mt-16 pb-6 text-center">
          <span
            className={
              isDark
                ? "text-base bg-gradient-to-r from-cyan-400/40 to-fuchsia-400/40 bg-clip-text text-transparent select-none transition-all duration-300 hover:from-cyan-300 hover:to-fuchsia-400 hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                : "text-base bg-gradient-to-r from-cyan-600/40 to-fuchsia-600/40 bg-clip-text text-transparent select-none transition-all duration-300 hover:from-cyan-600 hover:to-fuchsia-600 hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]"
            }
          >
            Built by @OrhanUlusoy
          </span>
        </footer>
      </div>
    </div>
  );
}
