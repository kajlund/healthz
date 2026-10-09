import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { db } from '../db/index.js';
import { papRecords } from '../db/schema.js';
import { PapRecordConflictError } from '../errors.js';
import type { DateRangeQuery } from '../common/filters.js';
import type { PapRecordInput } from './schemas.js';

export type PapRecord = typeof papRecords.$inferSelect;

export interface PapRecordRepository {
  create(input: PapRecordInput): Promise<PapRecord>;
  list(query?: DateRangeQuery): Promise<PapRecord[]>;
  findById(id: string): Promise<PapRecord | undefined>;
  update(id: string, input: PapRecordInput): Promise<PapRecord | undefined>;
  delete(id: string): Promise<boolean>;
}

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
};

export const valuesFromPapInput = (input: PapRecordInput) => ({
  ...input,
  usageMinutes: input.usageMinutes ?? null,
  eventsPerHour: input.eventsPerHour ?? null,
  maskSealScore: input.maskSealScore ?? null,
  maskOnOffCount: input.maskOnOffCount ?? null,
  totalScore: input.totalScore ?? null,
  notes: input.notes ?? null,
});

export const papRecordRepository: PapRecordRepository = {
  async create(input) {
    try {
      const [record] = await db
        .insert(papRecords)
        .values(valuesFromPapInput(input))
        .returning();
      return record!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new PapRecordConflictError();
      throw error;
    }
  },
  async list(query?: DateRangeQuery) {
    const conditions = [];
    if (query?.from) conditions.push(gte(papRecords.therapyDate, query.from));
    if (query?.to) conditions.push(lte(papRecords.therapyDate, query.to));
    const where = conditions.length ? and(...conditions) : undefined;
    return db
      .select()
      .from(papRecords)
      .where(where)
      .orderBy(desc(papRecords.therapyDate));
  },
  async findById(id) {
    const [record] = await db
      .select()
      .from(papRecords)
      .where(eq(papRecords.id, id))
      .limit(1);
    return record;
  },
  async update(id, input) {
    try {
      const [record] = await db
        .update(papRecords)
        .set({ ...valuesFromPapInput(input), updatedAt: new Date() })
        .where(eq(papRecords.id, id))
        .returning();
      return record;
    } catch (error) {
      if (isUniqueViolation(error)) throw new PapRecordConflictError();
      throw error;
    }
  },
  async delete(id) {
    const deleted = await db
      .delete(papRecords)
      .where(eq(papRecords.id, id))
      .returning({ id: papRecords.id });
    return deleted.length > 0;
  },
};
