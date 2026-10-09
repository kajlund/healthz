import type { ReportFormat } from './report-format.js';
import type { DashboardResponse } from './api.js';
export const latestSleepDetail = (
  sleep: NonNullable<DashboardResponse['latest']['sleep']>,
) =>
  [
    sleep.sleepDate,
    ...(sleep.sleepScore === null ? [] : [`Score ${sleep.sleepScore}`]),
    ...(sleep.awakeCount === null ? [] : [`Times awake: ${sleep.awakeCount}`]),
    ...(sleep.detailMode === 'sessions'
      ? [
          `${sleep.sessionCount} ${sleep.sessionCount === 1 ? 'session' : 'sessions'}${sleep.napCount ? `, including ${sleep.napCount} ${sleep.napCount === 1 ? 'nap' : 'naps'}` : sleep.sessionCount > 1 ? ', with additional sleep' : ''}`,
        ]
      : []),
  ].join(' · ');
export const currentLocalMonth = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const validDashboardMonth = (
  value: string | null,
  fallback = currentLocalMonth(),
) => (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback);
export const previousCalendarMonth = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year!, value! - 2, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
export type DeltaResult = { short: string; accessible: string } | null;
export const formatDelta = (
  current: number | null,
  previous: number | null,
  format: ReportFormat,
): DeltaResult => {
  if (current === null || previous === null) return null;
  const decimals =
    format === 'weight'
      ? 2
      : format === 'pressure' || format === 'pulse'
        ? 1
        : format === 'duration'
          ? 0
          : 2;
  const difference = Number((current - previous).toFixed(decimals));
  if (difference === 0)
    return {
      short: 'No change',
      accessible: 'No change at displayed precision.',
    };
  const direction = difference > 0 ? 'more' : 'less';
  const verb = difference > 0 ? 'Increased' : 'Decreased';
  const amount = Math.abs(difference);
  if (format === 'duration')
    return {
      short: `${amount} min ${direction}`,
      accessible: `${amount} minutes ${direction} than the previous month.`,
    };
  const unit =
    format === 'weight'
      ? 'kg'
      : format === 'pressure'
        ? 'mmHg'
        : format === 'pap-events'
          ? 'events/hour'
          : format === 'count'
            ? 'times'
            : 'points';
  return {
    short: `${difference > 0 ? '+' : '−'}${amount.toFixed(decimals)} ${unit}`,
    accessible: `${verb} by ${amount.toFixed(decimals)} ${unit} from the previous month.`,
  };
};
export const usableValueCount = (values: Array<number | null>) =>
  values.filter((value) => value !== null).length;
