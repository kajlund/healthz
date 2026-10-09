import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { db } from '../db/index.js';
import { bodyMeasurements } from '../db/schema.js';
import { BodyMeasurementConflictError } from '../errors.js';
import type { DateRangeQuery } from '../common/filters.js';
import type { BodyMeasurementInput } from './schemas.js';

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;

export interface BodyMeasurementRepository {
  create(input: BodyMeasurementInput): Promise<BodyMeasurement>;
  list(query?: DateRangeQuery): Promise<BodyMeasurement[]>;
  findById(id: string): Promise<BodyMeasurement | undefined>;
  update(
    id: string,
    input: BodyMeasurementInput,
  ): Promise<BodyMeasurement | undefined>;
  delete(id: string): Promise<boolean>;
}

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
};

export const bodyMeasurementRepository: BodyMeasurementRepository = {
  async create(input) {
    try {
      const [measurement] = await db
        .insert(bodyMeasurements)
        .values(input)
        .returning();
      return measurement!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new BodyMeasurementConflictError();
      throw error;
    }
  },

  async list(query?: DateRangeQuery) {
    const conditions = [];
    if (query?.from)
      conditions.push(gte(bodyMeasurements.measuredOn, query.from));
    if (query?.to) conditions.push(lte(bodyMeasurements.measuredOn, query.to));
    const where = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(bodyMeasurements)
      .where(where)
      .orderBy(desc(bodyMeasurements.measuredOn));
  },

  async findById(id) {
    const [measurement] = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.id, id))
      .limit(1);
    return measurement;
  },

  async update(id, input) {
    try {
      const [measurement] = await db
        .update(bodyMeasurements)
        .set({ ...input, notes: input.notes ?? null, updatedAt: new Date() })
        .where(eq(bodyMeasurements.id, id))
        .returning();
      return measurement;
    } catch (error) {
      if (isUniqueViolation(error)) throw new BodyMeasurementConflictError();
      throw error;
    }
  },

  async delete(id) {
    const deleted = await db
      .delete(bodyMeasurements)
      .where(eq(bodyMeasurements.id, id))
      .returning({ id: bodyMeasurements.id });
    return deleted.length > 0;
  },
};
