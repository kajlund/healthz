import { desc, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { bloodPressureReadings } from "../db/schema.js";
import type { BloodPressureReadingInput } from "./schemas.js";

export type BloodPressureReading = typeof bloodPressureReadings.$inferSelect;

export interface BloodPressureReadingRepository {
  create(input: BloodPressureReadingInput): Promise<BloodPressureReading>;
  list(): Promise<BloodPressureReading[]>;
  findById(id: string): Promise<BloodPressureReading | undefined>;
  update(id: string, input: BloodPressureReadingInput): Promise<BloodPressureReading | undefined>;
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

  async list() {
    return db.select().from(bloodPressureReadings).orderBy(desc(bloodPressureReadings.measuredAt));
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
