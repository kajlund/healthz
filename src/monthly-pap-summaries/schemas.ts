import { z } from "zod";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be a month in YYYY-MM format");
const decimal = z.number().nonnegative().multipleOf(0.01).nullable().optional();
const notes = z.union([z.string().trim().max(2000).transform((value) => value || null), z.null()]).optional();
const daysInMonth = (value: string) => { const [year, monthNumber] = value.split("-").map(Number); return new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate(); };

const schema = z.object({
  summaryMonth: month,
  averageUsageMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  averageEventsPerHour: decimal,
  averageMaskSealScore: decimal,
  averageMaskOnOffCount: decimal,
  averageTotalScore: decimal.refine((value) => value === undefined || value === null || value <= 100, "Must be at most 100"),
  daysRecorded: z.number().int().positive().nullable().optional(),
  source: z.string().trim().min(1).max(200),
  notes,
}).strict().superRefine((value, context) => {
  const measurements = [value.averageUsageMinutes, value.averageEventsPerHour, value.averageMaskSealScore, value.averageMaskOnOffCount, value.averageTotalScore];
  if (!measurements.some((item) => item !== undefined && item !== null)) context.addIssue({ code: "custom", message: "At least one PAP average is required", path: ["averageUsageMinutes"] });
  if (value.daysRecorded !== undefined && value.daysRecorded !== null && value.daysRecorded > daysInMonth(value.summaryMonth)) context.addIssue({ code: "custom", message: "Days recorded cannot exceed the number of days in the month", path: ["daysRecorded"] });
});

export const createMonthlyPapSummarySchema = schema;
export const updateMonthlyPapSummarySchema = schema;
export const monthlyPapSummaryIdSchema = z.uuid();
export type MonthlyPapSummaryInput = z.infer<typeof schema>;
