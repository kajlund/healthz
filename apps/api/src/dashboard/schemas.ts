import { z } from 'zod';
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
    'Must be a valid date',
  );
export const dashboardQuerySchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be a month in YYYY-MM format'),
    today: dateOnly.optional(),
    currentTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  })
  .strict();
