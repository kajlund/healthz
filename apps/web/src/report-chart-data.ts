import type { ChartData, ChartDataset } from 'chart.js';
import type { MonthlyReport, ReportMetric, YearReportResponse } from './api.js';
import { localizedMonth, type ReportFormat } from './report-format.js';

export type MetricChoice = {
  key: string;
  label: string;
  format: ReportFormat;
  get: (report: MonthlyReport) => ReportMetric | null;
};
export const reportChoices: MetricChoice[] = [
  {
    key: 'weight',
    label: 'Average weight',
    format: 'weight',
    get: (r) => r.weight?.average ?? null,
  },
  {
    key: 'systolic',
    label: 'Average systolic',
    format: 'pressure',
    get: (r) => r.bloodPressure?.averageSystolic ?? null,
  },
  {
    key: 'diastolic',
    label: 'Average diastolic',
    format: 'pressure',
    get: (r) => r.bloodPressure?.averageDiastolic ?? null,
  },
  {
    key: 'pulse',
    label: 'Average pulse',
    format: 'pulse',
    get: (r) => r.bloodPressure?.averagePulse ?? null,
  },
  {
    key: 'sleep-total',
    label: 'Total sleep',
    format: 'duration',
    get: (r) => r.sleep.averageTotalSleepMinutes,
  },
  {
    key: 'sleep-awake',
    label: 'Total time awake',
    format: 'duration',
    get: (r) => r.sleep.averageAwakeMinutes,
  },
  {
    key: 'sleep-awake-count',
    label: 'Average times awake',
    format: 'count',
    get: (r) => r.sleep.averageAwakeCount,
  },
  {
    key: 'sleep-light',
    label: 'Light sleep',
    format: 'duration',
    get: (r) => r.sleep.averageLightMinutes,
  },
  {
    key: 'sleep-deep',
    label: 'Deep sleep',
    format: 'duration',
    get: (r) => r.sleep.averageDeepMinutes,
  },
  {
    key: 'sleep-rem',
    label: 'REM sleep',
    format: 'duration',
    get: (r) => r.sleep.averageRemMinutes,
  },
  {
    key: 'sleep-score',
    label: 'Sleep score',
    format: 'sleep-score',
    get: (r) => r.sleep.averageSleepScore,
  },
  {
    key: 'pap-usage',
    label: 'Usage',
    format: 'duration',
    get: (r) => r.pap.averageUsageMinutes,
  },
  {
    key: 'pap-events',
    label: 'Events per hour',
    format: 'pap-events',
    get: (r) => r.pap.averageEventsPerHour,
  },
  {
    key: 'pap-seal',
    label: 'Mask seal score',
    format: 'mask-seal',
    get: (r) => r.pap.averageMaskSealScore,
  },
  {
    key: 'pap-onoff',
    label: 'Mask on/off count',
    format: 'mask-count',
    get: (r) => r.pap.averageMaskOnOffCount,
  },
  {
    key: 'pap-score',
    label: 'Total score',
    format: 'pap-score',
    get: (r) => r.pap.averageTotalScore,
  },
];
export const choiceFor = (key: string, fallback = 'weight') =>
  reportChoices.find((choice) => choice.key === key) ??
  reportChoices.find((choice) => choice.key === fallback)!;
export const monthLabels = (months: MonthlyReport[]) =>
  months.map(({ month }) => localizedMonth(month));
export const hasValues = (metrics: Array<ReportMetric | null>) =>
  metrics.some(
    (metric) => metric?.value !== null && metric?.value !== undefined,
  );
export const metricsFor = (months: MonthlyReport[], choice: MetricChoice) =>
  months.map(choice.get);
export const metricDataset = (
  label: string,
  metrics: Array<ReportMetric | null>,
  extras: Partial<ChartDataset<'line', Array<number | null>>> = {},
): ChartDataset<'line', Array<number | null>> => ({
  label,
  data: metrics.map((metric) => metric?.value ?? null),
  spanGaps: false,
  tension: 0.2,
  borderWidth: 2,
  pointRadius: metrics.map((metric) =>
    metric?.value === null || metric === null ? 0 : 4,
  ),
  pointHoverRadius: 6,
  pointStyle: 'circle',
  ...extras,
});
export const monthlyChartData = (
  months: MonthlyReport[],
  datasets: ChartDataset<'line', Array<number | null>>[],
): ChartData<'line', Array<number | null>> => ({
  labels: monthLabels(months),
  datasets,
});
export const yearSeriesData = (
  response: YearReportResponse,
  choice: MetricChoice,
): ChartData<'line', Array<number | null>> => ({
  labels: Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
      new Date(2024, index, 1, 12),
    ),
  ),
  datasets: response.series
    .filter(({ months }) => hasValues(metricsFor(months, choice)))
    .map(({ year, months }, index) =>
      metricDataset(String(year), metricsFor(months, choice), {
        borderDash: index % 3 === 1 ? [7, 4] : index % 3 === 2 ? [2, 3] : [],
        pointStyle:
          index % 3 === 1 ? 'rect' : index % 3 === 2 ? 'triangle' : 'circle',
      }),
    ),
});
export const validMetricKey = (value: string | null, prefix?: string) =>
  value !== null &&
  reportChoices.some(
    ({ key }) => key === value && (!prefix || key.startsWith(prefix)),
  )
    ? value
    : prefix === 'sleep-'
      ? 'sleep-total'
      : prefix === 'pap-'
        ? 'pap-usage'
        : 'weight';
