import { z } from "zod";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be a month in YYYY-MM format");
const duration = z.number().int().min(0).max(1440).nullable().optional();
const decimal = z.number().nonnegative().multipleOf(0.01).nullable().optional();
const notes = z.union([z.string().trim().max(2000).transform((value) => value || null), z.null()]).optional();
const daysInMonth = (value: string) => { const [year, monthNumber] = value.split("-").map(Number); return new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate(); };

const schema = z.object({
  summaryMonth: month,
  averageTotalSleepMinutes: duration,
  averageAwakeMinutes: duration,
  averageLightMinutes: duration,
  averageDeepMinutes: duration,
  averageRemMinutes: duration,
  averageSleepScore: decimal.refine((value) => value === undefined || value === null || value <= 100, "Must be at most 100"),
  daysRecorded: z.number().int().positive().nullable().optional(),
  source: z.string().trim().min(1).max(200),
  notes,
}).strict().superRefine((value, context) => {
  const measurements = [value.averageTotalSleepMinutes, value.averageAwakeMinutes, value.averageLightMinutes, value.averageDeepMinutes, value.averageRemMinutes, value.averageSleepScore];
  if (!measurements.some((item) => item !== undefined && item !== null)) context.addIssue({ code: "custom", message: "At least one sleep average is required", path: ["averageTotalSleepMinutes"] });
  if (value.daysRecorded !== undefined && value.daysRecorded !== null && value.daysRecorded > daysInMonth(value.summaryMonth)) context.addIssue({ code: "custom", message: "Days recorded cannot exceed the number of days in the month", path: ["daysRecorded"] });
});

export const createMonthlySleepSummarySchema = schema;
export const updateMonthlySleepSummarySchema = schema;
export const monthlySleepSummaryIdSchema = z.uuid();
export type MonthlySleepSummaryInput = z.infer<typeof schema>;
