import { and, gte, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bloodPressureReadings, bodyMeasurements, monthlyPapSummaries, monthlySleepSummaries, papRecords, sleepRecords } from "../db/schema.js";
import type { MonthRange, ReportingDataSource } from "./types.js";
import { sleepStageCoverageSql } from "../sleep-records/reporting.js";

const startDate = (month: string) => `${month}-01`;
const nextMonth = (month: string) => { const [year, value] = month.split("-").map(Number); const next = value === 12 ? [year! + 1, 1] : [year!, value! + 1]; return `${next[0]}-${String(next[1]).padStart(2, "0")}-01`; };

export const createReportingDataSource = (database: typeof db): ReportingDataSource => ({
  async load(ranges: MonthRange[]) {
    const dateConditions = <T>(column: T) => or(...ranges.map(({ from, to }) => and(gte(column as never, startDate(from)), lt(column as never, nextMonth(to)))))!;
    const timestampConditions = or(...ranges.map(({ from, to }) => and(gte(bloodPressureReadings.measuredAt, new Date(`${startDate(from)}T00:00:00.000Z`)), lt(bloodPressureReadings.measuredAt, new Date(`${nextMonth(to)}T00:00:00.000Z`)))))!;
    const papReportingDate = sql<string>`coalesce(${papRecords.healthDate}, ${papRecords.therapyDate})`;
    const [weights, bloodPressures, sleep, pap, monthlySleep, monthlyPap] = await Promise.all([
      database.select({ measuredOn: bodyMeasurements.measuredOn, weightKg: bodyMeasurements.weightKg }).from(bodyMeasurements).where(dateConditions(bodyMeasurements.measuredOn)),
      database.select({ measuredAt: bloodPressureReadings.measuredAt, systolic: bloodPressureReadings.systolic, diastolic: bloodPressureReadings.diastolic, pulse: bloodPressureReadings.pulse }).from(bloodPressureReadings).where(timestampConditions),
      database.select({ sleepDate: sleepRecords.sleepDate, totalSleepMinutes: sleepRecords.totalSleepMinutes, awakeMinutes: sleepRecords.awakeMinutes, awakeCount: sleepRecords.awakeCount, stageCoverage: sleepStageCoverageSql, lightMinutes: sleepRecords.lightMinutes, deepMinutes: sleepRecords.deepMinutes, remMinutes: sleepRecords.remMinutes, sleepScore: sleepRecords.sleepScore }).from(sleepRecords).where(dateConditions(sleepRecords.sleepDate)),
      database.select({ therapyDate: papRecords.therapyDate, healthDate: papRecords.healthDate, usageMinutes: papRecords.usageMinutes, eventsPerHour: papRecords.eventsPerHour, maskSealScore: papRecords.maskSealScore, maskOnOffCount: papRecords.maskOnOffCount, totalScore: papRecords.totalScore }).from(papRecords).where(dateConditions(papReportingDate)),
      database.select({ summaryMonth: monthlySleepSummaries.summaryMonth, averageTotalSleepMinutes: monthlySleepSummaries.averageTotalSleepMinutes, averageAwakeMinutes: monthlySleepSummaries.averageAwakeMinutes, averageLightMinutes: monthlySleepSummaries.averageLightMinutes, averageDeepMinutes: monthlySleepSummaries.averageDeepMinutes, averageRemMinutes: monthlySleepSummaries.averageRemMinutes, averageSleepScore: monthlySleepSummaries.averageSleepScore, daysRecorded: monthlySleepSummaries.daysRecorded }).from(monthlySleepSummaries).where(dateConditions(monthlySleepSummaries.summaryMonth)),
      database.select({ summaryMonth: monthlyPapSummaries.summaryMonth, averageUsageMinutes: monthlyPapSummaries.averageUsageMinutes, averageEventsPerHour: monthlyPapSummaries.averageEventsPerHour, averageMaskSealScore: monthlyPapSummaries.averageMaskSealScore, averageMaskOnOffCount: monthlyPapSummaries.averageMaskOnOffCount, averageTotalScore: monthlyPapSummaries.averageTotalScore, daysRecorded: monthlyPapSummaries.daysRecorded }).from(monthlyPapSummaries).where(dateConditions(monthlyPapSummaries.summaryMonth)),
    ]);
    return { weights, bloodPressures, sleepRecords: sleep, papRecords: pap, monthlySleep, monthlyPap };
  },
});

export const reportingDataSource = createReportingDataSource(db);
