import { and, gte, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bloodPressureReadings, bodyMeasurements, papRecords, sleepRecords, sleepMonthlyAverages } from "../db/schema.js";
import type { MonthRange, ReportingDataSource } from "./types.js";
import { sleepStageCoverageSql } from "../sleep-records/reporting.js";

const startDate = (month: string) => `${month}-01`;
const nextMonth = (month: string) => { const [year, value] = month.split("-").map(Number); const next = value === 12 ? [year! + 1, 1] : [year!, value! + 1]; return `${next[0]}-${String(next[1]).padStart(2, "0")}-01`; };

export const createReportingDataSource = (database: typeof db): ReportingDataSource => ({
  async load(ranges: MonthRange[]) {
    const dateConditions = <T>(column: T) => or(...ranges.map(({ from, to }) => and(gte(column as never, startDate(from)), lt(column as never, nextMonth(to)))))!;
    const timestampConditions = or(...ranges.map(({ from, to }) => and(gte(bloodPressureReadings.measuredAt, new Date(`${startDate(from)}T00:00:00.000Z`)), lt(bloodPressureReadings.measuredAt, new Date(`${nextMonth(to)}T00:00:00.000Z`)))))!;
    const papReportingDate = sql<string>`coalesce(${papRecords.healthDate}, ${papRecords.therapyDate})`;
    const [weights, bloodPressures, sleep, pap, monthlySleep] = await Promise.all([
      database.select({ measuredOn: bodyMeasurements.measuredOn, weightKg: bodyMeasurements.weightKg }).from(bodyMeasurements).where(dateConditions(bodyMeasurements.measuredOn)),
      database.select({ measuredAt: bloodPressureReadings.measuredAt, systolic: bloodPressureReadings.systolic, diastolic: bloodPressureReadings.diastolic, pulse: bloodPressureReadings.pulse }).from(bloodPressureReadings).where(timestampConditions),
      database.select({ sleepDate: sleepRecords.sleepDate, totalSleepMinutes: sleepRecords.totalSleepMinutes, awakeMinutes: sleepRecords.awakeMinutes, awakeCount: sleepRecords.awakeCount, stageCoverage: sleepStageCoverageSql, lightMinutes: sleepRecords.lightMinutes, deepMinutes: sleepRecords.deepMinutes, remMinutes: sleepRecords.remMinutes, sleepScore: sleepRecords.sleepScore }).from(sleepRecords).where(dateConditions(sleepRecords.sleepDate)),
      database.select({ therapyDate: papRecords.therapyDate, healthDate: papRecords.healthDate, usageMinutes: papRecords.usageMinutes, eventsPerHour: papRecords.eventsPerHour, maskSealScore: papRecords.maskSealScore, maskOnOffCount: papRecords.maskOnOffCount, totalScore: papRecords.totalScore }).from(papRecords).where(dateConditions(papReportingDate)),
      database.select().from(sleepMonthlyAverages).where(dateConditions(sql`make_date(${sleepMonthlyAverages.year}, ${sleepMonthlyAverages.month}, 1)`)),
    ]);
    return { weights, bloodPressures, sleepRecords: sleep, papRecords: pap, sleepMonthlyAverages: monthlySleep };
  },
});

export const reportingDataSource = createReportingDataSource(db);
