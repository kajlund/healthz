import { asc, count, eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { healthcareEventTags, healthcareTags } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  cleanHealthcareTagName,
  normalizeHealthcareTagName,
  type HealthcareTagInput,
} from './schemas.js';

export interface HealthcareTag {
  id: string;
  name: string;
  normalizedName: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface HealthcareTagRepository {
  list(): Promise<HealthcareTag[]>;
  create(input: HealthcareTagInput): Promise<HealthcareTag>;
  update(
    id: string,
    input: HealthcareTagInput,
  ): Promise<HealthcareTag | undefined>;
  delete(id: string): Promise<boolean>;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (('code' in error && error.code === '23505') ||
    ('cause' in error && isUniqueViolation(error.cause)));
const isForeignKeyViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (('code' in error && error.code === '23503') ||
    ('cause' in error && isForeignKeyViolation(error.cause)));
const duplicate = () =>
  new AppError(
    409,
    'CONFLICT',
    'A healthcare tag with this name already exists',
  );

const selectWithUsage = () =>
  db
    .select({
      id: healthcareTags.id,
      name: healthcareTags.name,
      normalizedName: healthcareTags.normalizedName,
      createdAt: healthcareTags.createdAt,
      updatedAt: healthcareTags.updatedAt,
      usageCount: count(healthcareEventTags.healthcareEventId),
    })
    .from(healthcareTags)
    .leftJoin(
      healthcareEventTags,
      eq(healthcareTags.id, healthcareEventTags.healthcareTagId),
    )
    .groupBy(healthcareTags.id);

export const healthcareTagRepository: HealthcareTagRepository = {
  async list() {
    const rows = await selectWithUsage().orderBy(
      asc(healthcareTags.normalizedName),
    );
    return rows.map((row) => ({ ...row, usageCount: Number(row.usageCount) }));
  },
  async create(input) {
    const name = cleanHealthcareTagName(input.name);
    try {
      const [tag] = await db
        .insert(healthcareTags)
        .values({ name, normalizedName: normalizeHealthcareTagName(name) })
        .returning();
      return { ...tag!, usageCount: 0 };
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate();
      throw error;
    }
  },
  async update(id, input) {
    const name = cleanHealthcareTagName(input.name);
    try {
      const [tag] = await db
        .update(healthcareTags)
        .set({
          name,
          normalizedName: normalizeHealthcareTagName(name),
          updatedAt: new Date(),
        })
        .where(eq(healthcareTags.id, id))
        .returning();
      if (!tag) return undefined;
      const [usage] = await db
        .select({ value: count() })
        .from(healthcareEventTags)
        .where(eq(healthcareEventTags.healthcareTagId, id));
      return { ...tag, usageCount: Number(usage?.value ?? 0) };
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate();
      throw error;
    }
  },
  async delete(id) {
    try {
      const deleted = await db
        .delete(healthcareTags)
        .where(eq(healthcareTags.id, id))
        .returning({ id: healthcareTags.id });
      return deleted.length > 0;
    } catch (error) {
      if (isForeignKeyViolation(error))
        throw new AppError(
          409,
          'CONFLICT',
          'This healthcare tag is in use and cannot be deleted',
        );
      throw error;
    }
  },
};
