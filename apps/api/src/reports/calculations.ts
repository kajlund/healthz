import type { MonthlyReport, PapReport, ReportData, ReportMetric, SleepReport } from "./types.js";
import { effectivePapHealthDate } from "../pap-records/date.js";
import { stageCoverage } from "../sleep-records/service.js";

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const none = (): ReportMetric => ({ value: null, source: "none", sampleCount: null });
const dailyMetric = (values: number[], decimals: number): ReportMetric => values.length ? { value: round(average(values), decimals), source: "daily", sampleCount: values.length } : none();
const knownMetric = (values: Array<number | null>, decimals: number): ReportMetric => dailyMetric(values.filter((value): value is number => value !== null), decimals);
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

  const sleepDaily = data.sleepRecords.filter((item) => byMonth(item.sleepDate) === month);
  const coverage = sleepDaily.map((item) => item.stageCoverage ?? stageCoverage([item]));
  const sleep: SleepReport = {
    dailyRecordCount: sleepDaily.length,
    averageAwakeCount: dailyMetric(sleepDaily.flatMap((item) => item.awakeCount == null ? [] : [item.awakeCount]), 2),
    stageCoverage: { completeDays: coverage.filter((value) => value === "complete").length, partialDays: coverage.filter((value) => value === "partial").length, noStageDays: coverage.filter((value) => value === "none").length },
    averageTotalSleepMinutes: knownMetric(sleepDaily.map((item) => item.totalSleepMinutes), 0),
    averageAwakeMinutes: knownMetric(sleepDaily.map((item) => item.awakeMinutes), 0),
    averageLightMinutes: knownMetric(sleepDaily.map((item) => item.lightMinutes), 0),
    averageDeepMinutes: knownMetric(sleepDaily.map((item) => item.deepMinutes), 0),
    averageRemMinutes: knownMetric(sleepDaily.map((item) => item.remMinutes), 0),
    averageSleepScore: knownMetric(sleepDaily.map((item) => item.sleepScore), 2),
  };
  const papDaily = data.papRecords.filter((item) => byMonth(effectivePapHealthDate(item)) === month);
  const entered = data.sleepMonthlyAverages?.find((item) => `${item.year}-${String(item.month).padStart(2, "0")}` === month);
  for (const key of ["averageTotalSleepMinutes", "averageDeepMinutes", "averageLightMinutes", "averageRemMinutes"] as const) {
    sleep[key] = entered
      ? { value: entered[key], source: "monthly-average", sampleCount: null, dailyRecordCount: sleepDaily.length }
      : sleep[key];
  }
  const pap: PapReport = {
    averageUsageMinutes: knownMetric(papDaily.map((item) => item.usageMinutes), 0),
    averageEventsPerHour: knownMetric(papDaily.map((item) => item.eventsPerHour), 2),
    averageMaskSealScore: knownMetric(papDaily.map((item) => item.maskSealScore), 2),
    averageMaskOnOffCount: knownMetric(papDaily.map((item) => item.maskOnOffCount), 2),
    averageTotalScore: knownMetric(papDaily.map((item) => item.totalScore), 2),
  };
  return { month, weight, bloodPressure, sleep, pap };
});
