import { z } from 'zod';

const optionalNotes = z
  .union([
    z
      .string()
      .trim()
      .max(2000)
      .transform((value) => value || null),
    z.null(),
  ])
  .optional();

const bloodPressureReadingSchema = z
  .object({
    measuredAt: z.iso.datetime({ offset: true }),
    systolic: z.number().int().positive(),
    diastolic: z.number().int().positive(),
    pulse: z.number().int().positive().nullable().optional(),
    notes: optionalNotes,
  })
  .strict()
  .refine(({ systolic, diastolic }) => systolic > diastolic, {
    message: 'Systolic pressure must be greater than diastolic pressure',
    path: ['systolic'],
  });

export const createBloodPressureReadingSchema = bloodPressureReadingSchema;
export const updateBloodPressureReadingSchema = bloodPressureReadingSchema;
export const bloodPressureReadingIdSchema = z.uuid();

export type BloodPressureReadingInput = z.infer<
  typeof createBloodPressureReadingSchema
>;
