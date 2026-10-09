import type { ReportMetric, ReportSource } from './api.js';
export type ReportFormat =
  | 'weight'
  | 'pressure'
  | 'pulse'
  | 'duration'
  | 'count'
  | 'sleep-score'
  | 'pap-events'
  | 'mask-seal'
  | 'mask-count'
  | 'pap-score'
  | 'score'
  | 'decimal';
export const formatReportValue = (
  value: number | null,
  format: ReportFormat,
) => {
  if (value === null) return '—';
  if (format === 'duration')
    return `${Math.floor(value / 60)} h ${Math.round(value % 60)} min`;
  if (format === 'weight') return `${value.toFixed(2)} kg`;
  if (format === 'pressure') return `${value.toFixed(1)} mmHg`;
  if (format === 'pulse') return `${value.toFixed(1)} bpm`;
  if (format === 'sleep-score') return `${value.toFixed(2)} points`;
  if (format === 'pap-events') return `${value.toFixed(2)} events/hour`;
  if (format === 'mask-seal') return `${value.toFixed(2)} points`;
  if (format === 'mask-count') return `${value.toFixed(2)} times`;
  if (format === 'count') return `${value.toFixed(2)} times`;
  if (format === 'pap-score') return `${value.toFixed(2)} points`;
  if (format === 'score') return value.toFixed(2);
  return String(Number(value.toFixed(2)));
};
export const sourceLabel = (source: ReportSource) =>
  source === 'monthly-average'
    ? 'Monthly average'
    : source === 'daily'
      ? 'Daily'
      : 'No data';
export const metricDetail = (metric: ReportMetric) =>
  metric.source === 'monthly-average'
    ? `Monthly average · ${metric.dailyRecordCount ?? 0} daily records present, not included`
    : `${sourceLabel(metric.source)}${metric.sampleCount === null ? '' : ` · n=${metric.sampleCount}`}`;
export const localizedMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year!, month! - 1, 1, 12));
};
export const stageCoverageDetail = (
  coverage: import('../../api/src/reports/types.js').SleepStageCoverage,
) =>
  `Daily stage data (days): ${coverage.completeDays} complete, ${coverage.partialDays} partial, ${coverage.noStageDays} without stages`;
export const formatChartTick = (value: number, format: ReportFormat) =>
  format === 'duration' || format === 'count'
    ? formatReportValue(value, format)
    : String(value);
