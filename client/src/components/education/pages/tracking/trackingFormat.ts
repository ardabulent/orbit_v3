import type { Band } from "@/education/tracking/trackingBands";
import type { MetricDefinition } from "@/education/tracking/trackingMetrics";

/** Bant adları ve renkleri — ekranın her yerinde aynı. */
export const BAND_META: Record<Band, { label: string; className: string }> = {
  risk: {
    label: "Riskli",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  medium: {
    label: "Orta",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  safe: {
    label: "Güvenli",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  unbanded: {
    label: "Sınır yok",
    className: "bg-slate-50 text-slate-600 ring-slate-200",
  },
  insufficient: {
    label: "Yetersiz veri",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

const number = (value: number) =>
  value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

export function formatMetricValue(
  metric: MetricDefinition,
  value: number | undefined
): string {
  if (value === undefined) return "—";
  if (metric.unit === "%") return `%${number(value)}`;
  if (metric.unit === "net") return `${number(value)} net`;
  return number(value);
}

export const formatNumber = number;
