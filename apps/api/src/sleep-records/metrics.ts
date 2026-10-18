import { z } from 'zod';

export const sleepSources = [
  { key: 'manual', label: 'Manual' },
  { key: 'oneplus-ohealth', label: 'OnePlus / OHealth' },
  { key: 'garmin-vivofit-5', label: 'Garmin Vivofit 5' },
] as const;

// Normalize only known aliases for reporting; retain original provenance in storage.
export const canonicalSleepSource = (source?: string | null) => {
  const key = source?.trim().toLowerCase();
  if (!key) return 'unknown';
  if (
    [
      'oneplus',
      'ohealth',
      'oneplus/ohealth',
      'oneplus / ohealth',
      'oneplus-ohealth',
    ].includes(key)
  )
    return 'oneplus-ohealth';
  if (['garmin vivofit 5', 'garmin-vivofit-5'].includes(key))
    return 'garmin-vivofit-5';
  return key;
};

export interface SleepMetricDefinition {
  key: string;
  name: string;
  type: 'integer' | 'decimal' | 'duration';
  unit: string;
  aggregation: 'average' | 'sum' | 'minimum' | 'maximum' | 'count';
  comparable: boolean;
  sources: string[];
  enabled: boolean;
  displayOrder: number;
}
export const sleepMetricDefinitions: SleepMetricDefinition[] = [
  ['deepMinutes', 'Deep', 'duration', 'min', true],
  ['lightMinutes', 'Light', 'duration', 'min', true],
  ['remMinutes', 'REM', 'duration', 'min', true],
  ['awakeMinutes', 'Awake duration', 'duration', 'min', true],
  ['awakeCount', 'Awakenings', 'integer', 'count', true],
  ['sleepScore', 'Sleep score', 'integer', '0–100', false],
  ['restlessMoments', 'Restless moments', 'integer', 'count', false],
  ['restingHeartRate', 'Resting heart rate', 'integer', 'bpm', true],
  ['bodyBatteryChange', 'Body Battery change', 'integer', 'points', false],
  ['averageSpo2', 'Average SpO₂', 'decimal', '%', true],
  ['lowestSpo2', 'Lowest SpO₂', 'decimal', '%', true],
  ['averageRespiration', 'Average respiration', 'decimal', 'breaths/min', true],
  ['lowestRespiration', 'Lowest respiration', 'decimal', 'breaths/min', true],
].map(([key, name, type, unit, comparable], displayOrder) => ({
  key: key as string,
  name: name as string,
  type: type as SleepMetricDefinition['type'],
  unit: unit as string,
  comparable: comparable as boolean,
  aggregation: 'average',
  sources: [],
  enabled: displayOrder < 6,
  displayOrder,
}));

export const extraSleepMeasurementsSchema = z
  .object({
    restlessMoments: z.number().int().min(0).max(2147483647).optional(),
    restingHeartRate: z.number().int().positive().max(300).optional(),
    bodyBatteryChange: z.number().int().min(-100).max(100).optional(),
    averageSpo2: z.number().min(0).max(100).optional(),
    lowestSpo2: z.number().min(0).max(100).optional(),
    averageRespiration: z.number().positive().max(100).optional(),
    lowestRespiration: z.number().positive().max(100).optional(),
  })
  .strict();
export type ExtraSleepMeasurements = z.infer<
  typeof extraSleepMeasurementsSchema
>;
