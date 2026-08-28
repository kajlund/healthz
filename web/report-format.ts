import type { ReportMetric, ReportSource } from "./api.js";
export type ReportFormat = "weight" | "pressure" | "pulse" | "duration" | "score" | "decimal";
export const formatReportValue = (value: number | null, format: ReportFormat) => {
  if (value === null) return "—";
  if (format === "duration") return `${Math.floor(value / 60)} h ${Math.round(value % 60)} min`;
  if (format === "weight") return `${value.toFixed(2)} kg`;
  if (format === "pressure") return `${value.toFixed(1)} mmHg`;
  if (format === "pulse") return `${value.toFixed(1)} bpm`;
  if (format === "score") return value.toFixed(2);
  return String(Number(value.toFixed(2)));
};
export const sourceLabel = (source: ReportSource) => source === "daily" ? "Daily" : source === "monthly-summary" ? "Summary" : "No data";
export const metricDetail = (metric: ReportMetric) => `${sourceLabel(metric.source)}${metric.sampleCount === null ? "" : ` · n=${metric.sampleCount}`}`;
export const localizedMonth = (value: string) => { const [year, month] = value.split("-").map(Number); return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(year!, month! - 1, 1, 12)); };
