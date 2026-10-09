import { z } from 'zod';

const year = z.number().int().min(1900).max(9999);
const month = z.number().int().min(1).max(12);
const duration = z.number().int().min(0).max(1440);
export const monthlySleepValuesSchema = z
  .object({
    averageTotalSleepMinutes: duration,
    averageDeepMinutes: duration,
    averageLightMinutes: duration,
    averageRemMinutes: duration,
    source: z.string().trim().min(1).max(200).default('manual'),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export const createMonthlySleepSchema = monthlySleepValuesSchema.extend({
  year,
  month,
});
export const monthlySleepParamsSchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .pipe(year),
  month: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    .pipe(month),
});
export const monthlySleepQuerySchema = z
  .object({ year: monthlySleepParamsSchema.shape.year.optional() })
  .strict();
export type MonthlySleepInput = z.infer<typeof createMonthlySleepSchema>;
export type MonthlySleepValues = z.infer<typeof monthlySleepValuesSchema>;
