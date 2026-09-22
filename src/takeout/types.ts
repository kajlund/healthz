import type { BloodPressureReading } from "../blood-pressure-readings/repository.js";
import type { BodyMeasurement } from "../body-measurements/repository.js";
import type { HealthcareEvent } from "../healthcare-events/repository.js";
import type { HealthcareTag } from "../healthcare-tags/repository.js";
import type { PapRecord } from "../pap-records/repository.js";
import type { SleepRecord } from "../sleep-records/repository.js";

export type TakeoutDataset =
  | "all"
  | "body-measurements"
  | "blood-pressure"
  | "sleep"
  | "pap"
  | "journal-events"
  | "journal-tags";

export interface TakeoutCounts {
  bodyMeasurements: number;
  bloodPressureReadings: number;
  sleepRecords: number;
  sleepSessions: number;
  papRecords: number;
  healthcareEvents: number;
  healthcareTags: number;
}

export interface TakeoutData {
  version: 1;
  exportedAt: string;
  counts: TakeoutCounts;
  bodyMeasurements: BodyMeasurement[];
  bloodPressureReadings: BloodPressureReading[];
  sleepRecords: SleepRecord[];
  papRecords: PapRecord[];
  healthcareEvents: HealthcareEvent[];
  healthcareTags: HealthcareTag[];
}
