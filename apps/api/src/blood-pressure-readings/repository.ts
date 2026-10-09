import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '../db/index.js';
import { bloodPressureReadings } from '../db/schema.js';
import {
  followingCalendarDay,
  type DateRangeQuery,
} from '../common/filters.js';
import type { BloodPressureReadingInput } from './schemas.js';

export type BloodPressureReading = typeof bloodPressureReadings.$inferSelect;

export interface BloodPressureReadingRepository {
  create(input: BloodPressureReadingInput): Promise<BloodPressureReading>;
  list(query?: DateRangeQuery): Promise<BloodPressureReading[]>;
  findById(id: string): Promise<BloodPressureReading | undefined>;
  update(
    id: string,
    input: BloodPressureReadingInput,
  ): Promise<BloodPressureReading | undefined>;
  delete(id: string): Promise<boolean>;
}

const valuesFromInput = (input: BloodPressureReadingInput) => ({
  ...input,
  measuredAt: new Date(input.measuredAt),
  pulse: input.pulse ?? null,
  notes: input.notes ?? null,
});

export const bloodPressureReadingRepository: BloodPressureReadingRepository = {
  async create(input) {
    const [reading] = await db
      .insert(bloodPressureReadings)
      .values(valuesFromInput(input))
      .returning();
    return reading!;
  },

  async list(query?: DateRangeQuery) {
    const conditions = [];
    if (query?.from)
      conditions.push(
        gte(
          bloodPressureReadings.measuredAt,
          new Date(`${query.from}T00:00:00.000Z`),
        ),
      );
    if (query?.to)
      conditions.push(
        lt(
          bloodPressureReadings.measuredAt,
          new Date(`${followingCalendarDay(query.to)}T00:00:00.000Z`),
        ),
      );
    const where = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(bloodPressureReadings)
      .where(where)
      .orderBy(desc(bloodPressureReadings.measuredAt));
  },

  async findById(id) {
    const [reading] = await db
      .select()
      .from(bloodPressureReadings)
      .where(eq(bloodPressureReadings.id, id))
      .limit(1);
    return reading;
  },

  async update(id, input) {
    const [reading] = await db
      .update(bloodPressureReadings)
      .set({ ...valuesFromInput(input), updatedAt: new Date() })
      .where(eq(bloodPressureReadings.id, id))
      .returning();
    return reading;
  },

  async delete(id) {
    const deleted = await db
      .delete(bloodPressureReadings)
      .where(eq(bloodPressureReadings.id, id))
      .returning({ id: bloodPressureReadings.id });
    return deleted.length > 0;
  },
};
