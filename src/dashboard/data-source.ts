import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bloodPressureReadings, bodyMeasurements, papRecords, sleepRecords } from "../db/schema.js";
import type { DashboardLatestSource } from "./types.js";
import { sleepNapCountSql, sleepSessionCountSql } from "../sleep-records/reporting.js";

export const createDashboardLatestSource = (database: typeof db): DashboardLatestSource => ({
  async load() {
    const papReportingDate = sql<string>`coalesce(${papRecords.healthDate}, ${papRecords.therapyDate})`;
    const [weights, pressures, sleeps, paps] = await Promise.all([
      database.select({ measuredOn: bodyMeasurements.measuredOn, weightKg: bodyMeasurements.weightKg }).from(bodyMeasurements).orderBy(desc(bodyMeasurements.measuredOn)).limit(1),
      database.select({ measuredAt: bloodPressureReadings.measuredAt, systolic: bloodPressureReadings.systolic, diastolic: bloodPressureReadings.diastolic, pulse: bloodPressureReadings.pulse }).from(bloodPressureReadings).orderBy(desc(bloodPressureReadings.measuredAt)).limit(1),
      database.select({ sleepDate: sleepRecords.sleepDate, totalSleepMinutes: sleepRecords.totalSleepMinutes, sleepScore: sleepRecords.sleepScore, awakeCount: sleepRecords.awakeCount, detailMode: sleepRecords.detailMode, sessionCount: sleepSessionCountSql, napCount: sleepNapCountSql }).from(sleepRecords).orderBy(desc(sleepRecords.sleepDate)).limit(1),
      database.select({ therapyDate: papRecords.therapyDate, healthDate: papRecords.healthDate, usageMinutes: papRecords.usageMinutes, eventsPerHour: papRecords.eventsPerHour, totalScore: papRecords.totalScore }).from(papRecords).orderBy(desc(papReportingDate), desc(papRecords.therapyDate)).limit(1),
    ]);
    return { weight: weights[0] ?? null, bloodPressure: pressures[0] ?? null, sleep: sleeps[0] ?? null, pap: paps[0] ?? null };
  },
});

export const dashboardLatestSource = createDashboardLatestSource(db);
