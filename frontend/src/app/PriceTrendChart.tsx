"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TrendPoint = { year: number; price: number | null };

type Props = {
  apiBaseUrl: string;
  form: {
    area: number;
    rooms: number;
    district: string;
    year_built: number;
    monthly_fee: number;
  };
  highlightYear: number | null;
  isDark: boolean;
  labelYear: string;
  labelPrice: string;
  labelLoading: string;
  formatSek: (v: number) => string;
};

export default function PriceTrendChart({
  apiBaseUrl,
  form,
  highlightYear,
  isDark,
  labelYear,
  labelPrice,
  labelLoading,
  formatSek,
}: Props) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const formKey = useMemo(
    () =>
      `${form.area}-${form.rooms}-${form.district}-${form.year_built}-${form.monthly_fee}`,
    [form.area, form.rooms, form.district, form.year_built, form.monthly_fee],
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchTrend() {
      setLoading(true);
      const years = Array.from({ length: 25 }, (_, i) => 2000 + i);

      const results: TrendPoint[] = [];

      // Batch in groups of 5 to avoid hammering the API
      for (let i = 0; i < years.length; i += 5) {
        const batch = years.slice(i, i + 5);
        const promises = batch.map(async (year) => {
          try {
            const resp = await fetch(`${apiBaseUrl}/predict`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...form, transaction_year: year }),
            });
            if (!resp.ok) return { year, price: null };
            const json = await resp.json();
            return {
              year,
              price: json.predicted_total_price as number,
            };
          } catch {
            return { year, price: null };
          }
        });
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }

      if (!cancelled) {
        setData(results.sort((a, b) => a.year - b.year));
        setLoading(false);
      }
    }

    void fetchTrend();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, formKey, form]);

  if (loading) {
    return (
      <div
        className={
          isDark
            ? "flex h-56 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-sm text-slate-400"
            : "flex h-56 items-center justify-center rounded-xl border border-slate-300 bg-slate-100/80 text-sm text-slate-500"
        }
      >
        <span className="animate-pulse">{labelLoading}</span>
      </div>
    );
  }

  if (data.length === 0) return null;

  const validPrices = data
    .map((d) => d.price)
    .filter((p): p is number => p != null);
  const minPrice = Math.min(...validPrices);
  const maxPrice = Math.max(...validPrices);
  const padding = (maxPrice - minPrice) * 0.1 || 100000;

  const gradientId = "trendGradient";
  const glowId = "trendGlow";

  return (
    <div
      className={
        isDark
          ? "rounded-xl border border-slate-800 bg-[#13151a] p-5 shadow-lg shadow-black/40"
          : "rounded-xl border border-slate-300 bg-slate-100 p-5 shadow-lg shadow-slate-400/30 ring-1 ring-slate-200/60"
      }
    >
      <div
        className={
          isDark ? "mb-3 text-sm font-medium text-slate-300" : "mb-3 text-sm font-medium text-slate-600"
        }
      >
        {labelPrice}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#e879f9" />
            </linearGradient>
            <linearGradient id={`${gradientId}Fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? "#22d3ee" : "#06b6d4"} stopOpacity={0.25} />
              <stop offset="100%" stopColor={isDark ? "#e879f9" : "#d946ef"} stopOpacity={0.03} />
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "#1e293b" : "#cbd5e1"}
            vertical={false}
          />
          <XAxis
            dataKey="year"
            tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
            axisLine={{ stroke: isDark ? "#334155" : "#94a3b8" }}
            tickLine={false}
          />
          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tickFormatter={(v: number) =>
              `${(v / 1_000_000).toFixed(1)}M`
            }
            tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
              border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
              borderRadius: 8,
              boxShadow: isDark
                ? "0 8px 24px rgba(0,0,0,0.5)"
                : "0 8px 24px rgba(0,0,0,0.12)",
              color: isDark ? "#f1f5f9" : "#0f172a",
              fontSize: 13,
            }}
            labelFormatter={(label) => `${labelYear}: ${label}`}
            formatter={(value) => [formatSek(Number(value)), labelPrice]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={`url(#${gradientId})`}
            strokeWidth={3}
            fill={`url(#${gradientId}Fill)`}
            filter={`url(#${glowId})`}
            dot={(props: Record<string, unknown>) => {
              const cx = Number(props.cx ?? 0);
              const cy = Number(props.cy ?? 0);
              const payload = props.payload as TrendPoint | undefined;
              const year = payload?.year;
              if (year !== highlightYear) return <circle key={year ?? "n"} r={0} cx={cx} cy={cy} />;
              return (
                <circle
                  key={year}
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={isDark ? "#22d3ee" : "#0891b2"}
                  stroke={isDark ? "#0f172a" : "#f8fafc"}
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 5,
              fill: isDark ? "#e879f9" : "#c026d3",
              stroke: isDark ? "#0f172a" : "#f8fafc",
              strokeWidth: 2,
            }}
            animationDuration={1200}
            animationEasing="ease-in-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
