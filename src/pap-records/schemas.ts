import { z } from "zod";

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
  }, "Must be a valid calendar date");

const optionalNotes = z
  .union([z.string().trim().max(2000).transform((value) => value || null), z.null()])
  .optional();

const papRecordSchema = z
  .object({
    therapyDate: dateOnly,
    healthDate: dateOnly,
    usageMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
    eventsPerHour: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
    maskSealScore: z.number().int().nonnegative().nullable().optional(),
    maskOnOffCount: z.number().int().nonnegative().nullable().optional(),
    totalScore: z.number().int().min(0).max(100).nullable().optional(),
    source: z.string().trim().min(1).max(200),
    notes: optionalNotes,
  })
  .strict()
  .refine(
    ({ usageMinutes, eventsPerHour, maskSealScore, maskOnOffCount, totalScore }) =>
      [usageMinutes, eventsPerHour, maskSealScore, maskOnOffCount, totalScore].some(
        (value) => value !== undefined && value !== null,
      ),
    { message: "At least one PAP measurement is required", path: ["usageMinutes"] },
  );

export const createPapRecordSchema = papRecordSchema;
export const updatePapRecordSchema = papRecordSchema;
export const papRecordIdSchema = z.uuid();
export type PapRecordInput = z.infer<typeof createPapRecordSchema>;
