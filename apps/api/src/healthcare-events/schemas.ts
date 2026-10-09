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
const timeOnly = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a time in HH:mm format');
const optionalText = (maximum: number) =>
  z
    .union([
      z
        .string()
        .trim()
        .max(maximum)
        .transform((value) => value || null),
      z.null(),
    ])
    .optional();

export const healthcareEventInputSchema = z
  .object({
    eventDate: dateOnly,
    eventTime: z
      .union([timeOnly, z.literal('').transform(() => null), z.null()])
      .optional(),
    title: z.string().trim().min(1, 'Title is required').max(300),
    description: optionalText(10_000),
    provider: optionalText(300),
    organization: optionalText(300),
    location: optionalText(500),
    tagIds: z
      .array(z.uuid())
      .max(100)
      .optional()
      .default([])
      .transform((values) => [...new Set(values)]),
  })
  .strict();

const commaSeparatedIds = z
  .string()
  .max(4000)
  .transform((value, context) => {
    if (!value.trim()) return [];
    const values = [...new Set(value.split(',').map((item) => item.trim()))];
    const invalid = values.filter(
      (value) => !z.uuid().safeParse(value).success,
    );
    if (invalid.length) {
      context.addIssue({
        code: 'custom',
        message: 'tagIds must contain comma-separated UUIDs',
      });
      return z.NEVER;
    }
    return values;
  });

export const healthcareEventListQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    tagIds: commaSeparatedIds.optional().default([]),
    tagMatch: z.enum(['any', 'all']).optional().default('any'),
    search: z.string().trim().max(300).optional().default(''),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  })
  .strict()
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: 'from must not be after to',
    path: ['from'],
  });

export const healthcareEventIdSchema = z.uuid();
export type HealthcareEventInput = z.infer<typeof healthcareEventInputSchema>;
export type HealthcareEventListQuery = z.infer<
  typeof healthcareEventListQuerySchema
>;
