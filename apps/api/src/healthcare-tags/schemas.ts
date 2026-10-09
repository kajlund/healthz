import { z } from 'zod';

export const normalizeHealthcareTagName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
export const cleanHealthcareTagName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const healthcareTagInputSchema = z
  .object({
    name: z
      .string()
      .max(100)
      .transform(cleanHealthcareTagName)
      .pipe(z.string().min(1, 'Tag name is required')),
  })
  .strict();

export const healthcareTagIdSchema = z.uuid();
export type HealthcareTagInput = z.infer<typeof healthcareTagInputSchema>;
