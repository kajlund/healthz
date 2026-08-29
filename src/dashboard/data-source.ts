import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { bloodPressureReadings, bodyMeasurements, papRecords, sleepRecords } from "../db/schema.js";
import type { DashboardLatestSource } from "./types.js";

export const dashboardLatestSource: DashboardLatestSource = {
  async load() {
    const papReportingDate = sql<string>`coalesce(${papRecords.healthDate}, ${papRecords.therapyDate})`;
    const [weights, pressures, sleeps, paps] = await Promise.all([
      db.select({ measuredOn: bodyMeasurements.measuredOn, weightKg: bodyMeasurements.weightKg }).from(bodyMeasurements).orderBy(desc(bodyMeasurements.measuredOn)).limit(1),
      db.select({ measuredAt: bloodPressureReadings.measuredAt, systolic: bloodPressureReadings.systolic, diastolic: bloodPressureReadings.diastolic, pulse: bloodPressureReadings.pulse }).from(bloodPressureReadings).orderBy(desc(bloodPressureReadings.measuredAt)).limit(1),
      db.select({ sleepDate: sleepRecords.sleepDate, totalSleepMinutes: sleepRecords.totalSleepMinutes, sleepScore: sleepRecords.sleepScore }).from(sleepRecords).orderBy(desc(sleepRecords.sleepDate)).limit(1),
      db.select({ therapyDate: papRecords.therapyDate, healthDate: papRecords.healthDate, usageMinutes: papRecords.usageMinutes, eventsPerHour: papRecords.eventsPerHour, totalScore: papRecords.totalScore }).from(papRecords).orderBy(desc(papReportingDate), desc(papRecords.therapyDate)).limit(1),
    ]);
    return { weight: weights[0] ?? null, bloodPressure: pressures[0] ?? null, sleep: sleeps[0] ?? null, pap: paps[0] ?? null };
  },
};
