import type { MonthlyReport, PapReport, ReportData, ReportMetric, SleepReport } from "./types.js";
import { effectivePapHealthDate } from "../pap-records/date.js";

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const none = (): ReportMetric => ({ value: null, source: "none", sampleCount: null });
const dailyMetric = (values: number[], decimals: number): ReportMetric => values.length ? { value: round(average(values), decimals), source: "daily", sampleCount: values.length } : none();
const fallbackMetric = (daily: Array<number | null>, summary: number | null | undefined, days: number | null | undefined, decimals: number): ReportMetric => {
  const values = daily.filter((value): value is number => value !== null);
  if (values.length) return dailyMetric(values, decimals);
  return summary !== undefined && summary !== null ? { value: round(summary, decimals), source: "monthly-summary", sampleCount: days ?? null } : none();
};
const byMonth = (date: string) => date.slice(0, 7);

export const monthsBetween = (from: string, to: string) => {
  const [fromYear, fromMonth] = from.split("-").map(Number); const [toYear, toMonth] = to.split("-").map(Number);
  const months: string[] = []; let year = fromYear!; let month = fromMonth!;
  while (year < toYear! || (year === toYear && month <= toMonth!)) { months.push(`${year}-${String(month).padStart(2, "0")}`); month++; if (month === 13) { month = 1; year++; } }
  return months;
};

export const calculateMonthlyReports = (months: string[], data: ReportData): MonthlyReport[] => months.map((month) => {
  const weights = data.weights.filter((item) => byMonth(item.measuredOn) === month).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const weightValues = weights.map(({ weightKg }) => weightKg); const weightCount = weightValues.length;
  const metric = (value: number, decimals = 2): ReportMetric => ({ value: round(value, decimals), source: "daily", sampleCount: weightCount });
  const weight = weightCount ? { average: metric(average(weightValues)), minimum: metric(Math.min(...weightValues)), maximum: metric(Math.max(...weightValues)), first: metric(weightValues[0]!), last: metric(weightValues.at(-1)!), measurementCount: weightCount } : null;

  const readings = data.bloodPressures.filter((item) => item.measuredAt.toISOString().slice(0, 7) === month);
  const daily = new Map<string, typeof readings>();
  for (const reading of readings) { const day = reading.measuredAt.toISOString().slice(0, 10); daily.set(day, [...(daily.get(day) ?? []), reading]); }
  const dailyValues = [...daily.values()];
  const systolic = dailyValues.map((items) => average(items.map((item) => item.systolic)));
  const diastolic = dailyValues.map((items) => average(items.map((item) => item.diastolic)));
  const pulse = dailyValues.flatMap((items) => { const values = items.flatMap((item) => item.pulse === null ? [] : [item.pulse]); return values.length ? [average(values)] : []; });
  const bloodPressure = readings.length ? { averageSystolic: dailyMetric(systolic, 1), averageDiastolic: dailyMetric(diastolic, 1), averagePulse: dailyMetric(pulse, 1), readingCount: readings.length, measuredDayCount: daily.size } : null;

  const sleepDaily = data.sleepRecords.filter((item) => byMonth(item.sleepDate) === month); const sleepSummary = data.monthlySleep.find((item) => byMonth(item.summaryMonth) === month);
  const sleep: SleepReport = {
    averageTotalSleepMinutes: fallbackMetric(sleepDaily.map((item) => item.totalSleepMinutes), sleepSummary?.averageTotalSleepMinutes, sleepSummary?.daysRecorded, 0),
    averageAwakeMinutes: fallbackMetric(sleepDaily.map((item) => item.awakeMinutes), sleepSummary?.averageAwakeMinutes, sleepSummary?.daysRecorded, 0),
    averageLightMinutes: fallbackMetric(sleepDaily.map((item) => item.lightMinutes), sleepSummary?.averageLightMinutes, sleepSummary?.daysRecorded, 0),
    averageDeepMinutes: fallbackMetric(sleepDaily.map((item) => item.deepMinutes), sleepSummary?.averageDeepMinutes, sleepSummary?.daysRecorded, 0),
    averageRemMinutes: fallbackMetric(sleepDaily.map((item) => item.remMinutes), sleepSummary?.averageRemMinutes, sleepSummary?.daysRecorded, 0),
    averageSleepScore: fallbackMetric(sleepDaily.map((item) => item.sleepScore), sleepSummary?.averageSleepScore, sleepSummary?.daysRecorded, 2),
  };
  const papDaily = data.papRecords.filter((item) => byMonth(effectivePapHealthDate(item)) === month); const papSummary = data.monthlyPap.find((item) => byMonth(item.summaryMonth) === month);
  const pap: PapReport = {
    averageUsageMinutes: fallbackMetric(papDaily.map((item) => item.usageMinutes), papSummary?.averageUsageMinutes, papSummary?.daysRecorded, 0),
    averageEventsPerHour: fallbackMetric(papDaily.map((item) => item.eventsPerHour), papSummary?.averageEventsPerHour, papSummary?.daysRecorded, 2),
    averageMaskSealScore: fallbackMetric(papDaily.map((item) => item.maskSealScore), papSummary?.averageMaskSealScore, papSummary?.daysRecorded, 2),
    averageMaskOnOffCount: fallbackMetric(papDaily.map((item) => item.maskOnOffCount), papSummary?.averageMaskOnOffCount, papSummary?.daysRecorded, 2),
    averageTotalScore: fallbackMetric(papDaily.map((item) => item.totalScore), papSummary?.averageTotalScore, papSummary?.daysRecorded, 2),
  };
  return { month, weight, bloodPressure, sleep, pap };
});
