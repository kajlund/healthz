import type { SleepRecordInput, SleepSessionInput } from './schemas.js';

type OptionalMeasurement =
  'awakeMinutes' | 'awakeCount' | 'lightMinutes' | 'deepMinutes' | 'remMinutes';
type Stages = {
  lightMinutes?: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
};
export type StageCoverage = 'complete' | 'partial' | 'none';

export const stageCoverage = (rows: Stages[]): StageCoverage => {
  const stages = rows.map((row) => [
    row.lightMinutes,
    row.deepMinutes,
    row.remMinutes,
  ]);
  if (
    stages.length &&
    stages.every((values) => values.every((value) => value != null))
  )
    return 'complete';
  return stages.some((values) => values.some((value) => value != null))
    ? 'partial'
    : 'none';
};

export const aggregateSessions = (sessions: SleepSessionInput[]) => {
  if (!sessions.length)
    throw new Error('At least one sleep session is required');
  const sumWhenComplete = (key: OptionalMeasurement) =>
    sessions.every((session) => session[key] != null)
      ? sessions.reduce((sum, session) => sum + session[key]!, 0)
      : null;
  return {
    totalSleepMinutes: sessions.reduce(
      (sum, session) => sum + session.totalSleepMinutes,
      0,
    ),
    awakeMinutes: sumWhenComplete('awakeMinutes'),
    awakeCount: sumWhenComplete('awakeCount'),
    lightMinutes: sumWhenComplete('lightMinutes'),
    deepMinutes: sumWhenComplete('deepMinutes'),
    remMinutes: sumWhenComplete('remMinutes'),
  };
};

export const valuesFromSleepInput = (input: SleepRecordInput) => ({
  sleepDate: input.sleepDate,
  detailMode: input.detailMode ?? 'summary',
  ...(input.detailMode === 'sessions'
    ? aggregateSessions(input.sessions)
    : {
        totalSleepMinutes: input.totalSleepMinutes,
        awakeMinutes: input.awakeMinutes ?? null,
        awakeCount: input.awakeCount ?? null,
        lightMinutes: input.lightMinutes ?? null,
        deepMinutes: input.deepMinutes ?? null,
        remMinutes: input.remMinutes ?? null,
      }),
  sleepScore: input.sleepScore ?? null,
  source: input.source,
  notes: input.notes ?? null,
});

export const valuesFromSessionInput = (
  input: SleepSessionInput,
  sleepRecordId: string,
) => ({
  ...input,
  sleepRecordId,
  label: input.label ?? null,
  source: input.source ?? null,
  startedAt: input.startedAt ? new Date(input.startedAt) : null,
  endedAt: input.endedAt ? new Date(input.endedAt) : null,
  awakeMinutes: input.awakeMinutes ?? null,
  awakeCount: input.awakeCount ?? null,
  lightMinutes: input.lightMinutes ?? null,
  deepMinutes: input.deepMinutes ?? null,
  remMinutes: input.remMinutes ?? null,
});
