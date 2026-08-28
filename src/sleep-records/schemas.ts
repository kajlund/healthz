import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}, "Must be a valid calendar date");

const duration = z.number().int().min(0).max(24 * 60).nullable().optional();
const optionalNotes = z.union([z.string().trim().max(2000).transform((value) => value || null), z.null()]).optional();
const sleepRecordSchema = z.object({
  sleepDate: dateOnly,
  totalSleepMinutes: z.number().int().positive().max(24 * 60),
  awakeMinutes: duration,
  lightMinutes: duration,
  deepMinutes: duration,
  remMinutes: duration,
  sleepScore: z.number().int().min(0).max(100).nullable().optional(),
  source: z.string().trim().min(1).max(200),
  notes: optionalNotes,
}).strict();

export const createSleepRecordSchema = sleepRecordSchema;
export const updateSleepRecordSchema = sleepRecordSchema;
export const sleepRecordIdSchema = z.uuid();
export type SleepRecordInput = z.infer<typeof createSleepRecordSchema>;
