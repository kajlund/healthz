import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value)
    );
  }, 'Must be a valid calendar date');

const fields = {
  measuredOn: dateOnly,
  weightKg: z.number().positive().max(9999.99).multipleOf(0.01),
  notes: z.string().trim().max(2000).nullable().optional(),
};

export const createBodyMeasurementSchema = z.object(fields).strict();
export const updateBodyMeasurementSchema = z.object(fields).strict();
export const bodyMeasurementIdSchema = z.uuid();

export type BodyMeasurementInput = z.infer<typeof createBodyMeasurementSchema>;
