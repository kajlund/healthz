import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}, "Must be a valid calendar date");

const duration = z.number().int().min(0).max(24 * 60).nullable().optional();
const optionalNotes = z.union([z.string().trim().max(2000).transform((value) => value || null), z.null()]).optional();
const nonnegativeInteger = z.number().int().min(0).max(2_147_483_647);
const measurement = nonnegativeInteger.nullable().optional();
const optionalText = z.string().trim().max(200).nullable().optional();
export const sleepSessionSchema = z.object({
  sessionType: z.enum(["main-sleep", "nap", "other"]),
  label: optionalText,
  startedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  totalSleepMinutes: nonnegativeInteger.positive(),
  awakeMinutes: measurement,
  awakeCount: measurement,
  lightMinutes: measurement,
  deepMinutes: measurement,
  remMinutes: measurement,
  sortOrder: nonnegativeInteger,
  source: optionalText,
}).strict().refine((value) => !value.startedAt || !value.endedAt || new Date(value.endedAt) > new Date(value.startedAt), {
  message: "End must be after start", path: ["endedAt"],
});

const common = {
  sleepDate: dateOnly,
  sleepScore: z.number().int().min(0).max(100).nullable().optional(),
  source: z.string().trim().min(1).max(200),
  notes: optionalNotes,
};
const summarySchema = z.object({
  ...common,
  detailMode: z.literal("summary").optional(),
  totalSleepMinutes: z.number().int().positive().max(24 * 60),
  awakeMinutes: duration,
  awakeCount: measurement,
  lightMinutes: duration,
  deepMinutes: duration,
  remMinutes: duration,
  sessions: z.array(sleepSessionSchema).max(0).optional(),
}).strict();
const sessionsSchema = z.object({
  ...common,
  detailMode: z.literal("sessions"),
  sessions: z.array(sleepSessionSchema).min(1),
}).strict().superRefine(({ sessions }, context) => {
  for (const key of ["totalSleepMinutes", "awakeMinutes", "awakeCount", "lightMinutes", "deepMinutes", "remMinutes"] as const) {
    if (sessions.every((session) => session[key] != null) && sessions.reduce((sum, session) => sum + (session[key] ?? 0), 0) > 2_147_483_647) {
      context.addIssue({ code: "custom", message: `Aggregate ${key} exceeds integer storage`, path: ["sessions"] });
    }
  }
});
const sleepRecordSchema = z.union([summarySchema, sessionsSchema]);

export const createSleepRecordSchema = sleepRecordSchema;
export const updateSleepRecordSchema = sleepRecordSchema;
export const sleepRecordIdSchema = z.uuid();
export type SleepRecordInput = z.infer<typeof createSleepRecordSchema>;
export type SleepSessionInput = z.infer<typeof sleepSessionSchema>;
