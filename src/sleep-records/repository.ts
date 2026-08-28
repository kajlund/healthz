import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sleepRecords } from "../db/schema.js";
import { SleepRecordConflictError } from "../errors.js";
import type { SleepRecordInput } from "./schemas.js";

export type SleepRecord = typeof sleepRecords.$inferSelect;
export interface SleepRecordRepository {
  create(input: SleepRecordInput): Promise<SleepRecord>;
  list(): Promise<SleepRecord[]>;
  findById(id: string): Promise<SleepRecord | undefined>;
  update(id: string, input: SleepRecordInput): Promise<SleepRecord | undefined>;
  delete(id: string): Promise<boolean>;
}
const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
};
const valuesFromInput = (input: SleepRecordInput) => ({
  ...input,
  awakeMinutes: input.awakeMinutes ?? null,
  lightMinutes: input.lightMinutes ?? null,
  deepMinutes: input.deepMinutes ?? null,
  remMinutes: input.remMinutes ?? null,
  sleepScore: input.sleepScore ?? null,
  notes: input.notes ?? null,
});
export const sleepRecordRepository: SleepRecordRepository = {
  async create(input) {
    try {
      const [record] = await db.insert(sleepRecords).values(valuesFromInput(input)).returning();
      return record!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new SleepRecordConflictError();
      throw error;
    }
  },
  async list() { return db.select().from(sleepRecords).orderBy(desc(sleepRecords.sleepDate)); },
  async findById(id) {
    const [record] = await db.select().from(sleepRecords).where(eq(sleepRecords.id, id)).limit(1);
    return record;
  },
  async update(id, input) {
    try {
      const [record] = await db.update(sleepRecords).set({ ...valuesFromInput(input), updatedAt: new Date() }).where(eq(sleepRecords.id, id)).returning();
      return record;
    } catch (error) {
      if (isUniqueViolation(error)) throw new SleepRecordConflictError();
      throw error;
    }
  },
  async delete(id) {
    const deleted = await db.delete(sleepRecords).where(eq(sleepRecords.id, id)).returning({ id: sleepRecords.id });
    return deleted.length > 0;
  },
};
