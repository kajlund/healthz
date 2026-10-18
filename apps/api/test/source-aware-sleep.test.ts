import { describe, expect, it } from 'vitest';
import { createSleepRecordSchema } from '../src/sleep-records/schemas.js';
import { valuesFromSleepInput } from '../src/sleep-records/service.js';
import { calculateMonthlyReports } from '../src/reports/calculations.js';
import type { ReportData } from '../src/reports/types.js';

const nightly = {
  sleepDate: '2026-10-18',
  totalSleepMinutes: 420,
  source: 'garmin-vivofit-5',
  totalScope: 'overnight' as const,
};
describe('source-aware sleep', () => {
  it('accepts Garmin required data only and leaves unrecorded details empty', () => {
    const row = valuesFromSleepInput(createSleepRecordSchema.parse(nightly));
    expect(row).toMatchObject({
      totalSleepMinutes: 420,
      deepMinutes: null,
      sleepScore: null,
      measurements: {},
    });
    expect(
      valuesFromSleepInput(
        createSleepRecordSchema.parse({
          ...nightly,
          measurements: { averageSpo2: 96.5, bodyBatteryChange: 0 },
        }),
      ).measurements,
    ).toEqual({ averageSpo2: 96.5, bodyBatteryChange: 0 });
    expect(
      createSleepRecordSchema.safeParse({
        ...nightly,
        measurements: { averageSpo2: 101 },
      }).success,
    ).toBe(false);
    expect(
      createSleepRecordSchema.safeParse({
        ...nightly,
        measurements: { restlessMoments: 1.5 },
      }).success,
    ).toBe(false);
  });
  it('does not add summary naps or their stages to nightly values', () => {
    const row = valuesFromSleepInput(
      createSleepRecordSchema.parse({
        ...nightly,
        deepMinutes: 80,
        sessions: [
          {
            sessionType: 'nap',
            source: 'manual',
            sortOrder: 0,
            startedAt: '2026-10-18T13:00:00+03:00',
            totalSleepMinutes: 30,
            deepMinutes: 10,
          },
        ],
      }),
    );
    expect(row).toMatchObject({ totalSleepMinutes: 420, deepMinutes: 80 });
  });
  it('excludes naps from new session totals without reinterpreting legacy input', () => {
    const input = {
      sleepDate: nightly.sleepDate,
      source: nightly.source,
      detailMode: 'sessions',
      sessions: [
        {
          sessionType: 'main-sleep',
          sortOrder: 0,
          totalSleepMinutes: 420,
          deepMinutes: 80,
        },
        {
          sessionType: 'nap',
          sortOrder: 1,
          totalSleepMinutes: 30,
          deepMinutes: 10,
          startedAt: '2026-10-18T13:00:00Z',
        },
      ],
    };
    expect(
      valuesFromSleepInput(createSleepRecordSchema.parse(input)),
    ).toMatchObject({
      totalSleepMinutes: 450,
      deepMinutes: 90,
      totalScope: 'legacy-all',
    });
    expect(
      valuesFromSleepInput(
        createSleepRecordSchema.parse({ ...input, totalScope: 'overnight' }),
      ),
    ).toMatchObject({ totalSleepMinutes: 420, deepMinutes: 80 });
  });
  it('groups scores by source, excludes missing values and preserves monthly duration priority', () => {
    const row = {
      ...valuesFromSleepInput(createSleepRecordSchema.parse(nightly)),
      sleepScore: 90,
    };
    const data: ReportData = {
      weights: [],
      bloodPressures: [],
      papRecords: [],
      sleepRecords: [
        row,
        { ...row, source: 'OnePlus/OHealth', sleepScore: 50 },
        { ...row, source: 'ohealth', sleepScore: null },
      ],
      sleepMonthlyAverages: [
        {
          year: 2026,
          month: 10,
          averageTotalSleepMinutes: 500,
          averageDeepMinutes: 90,
          averageLightMinutes: 300,
          averageRemMinutes: 110,
        },
      ],
    };
    const sleep = calculateMonthlyReports(['2026-10'], data)[0]!.sleep;
    expect(sleep.averageSleepScore.value).toBeNull();
    expect(sleep.scoresBySource?.['garmin-vivofit-5']).toMatchObject({
      value: 90,
      sampleCount: 1,
    });
    expect(sleep.scoresBySource?.['oneplus-ohealth']).toMatchObject({
      value: 50,
      sampleCount: 1,
    });
    expect(sleep.averageTotalSleepMinutes).toMatchObject({
      value: 500,
      source: 'monthly-average',
    });
  });
});
