import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { sleepRecords, sleepSessions } from "../db/schema.js";
import { AppError, SleepRecordConflictError } from "../errors.js";
import type { DateRangeQuery } from "../common/filters.js";
import { createSleepRecordSchema, updateSleepRecordSchema, type SleepRecordInput } from "./schemas.js";
import { stageCoverage, valuesFromSessionInput, valuesFromSleepInput, type StageCoverage } from "./service.js";

type SleepRow = typeof sleepRecords.$inferSelect;
export type SleepSession = typeof sleepSessions.$inferSelect;
export type SleepRecord = SleepRow & { sessions: SleepSession[]; stageCoverage: StageCoverage };
export interface SleepRecordRepository {
  create(input: SleepRecordInput): Promise<SleepRecord>;
  list(query?: DateRangeQuery): Promise<SleepRecord[]>;
  findById(id: string): Promise<SleepRecord | undefined>;
  update(id: string, input: SleepRecordInput): Promise<SleepRecord | undefined>;
  delete(id: string): Promise<boolean>;
}
const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
};
const publicRecord = (row: SleepRow, sessions: SleepSession[]): SleepRecord => ({
  ...row, sessions, stageCoverage: stageCoverage(row.detailMode === "sessions" ? sessions : [row]),
});
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const sessionOrder = [asc(sleepSessions.sortOrder), sql`${sleepSessions.startedAt} asc nulls last`, asc(sleepSessions.id)] as const;
const loadSessions = async (tx: Transaction, ids: string[]) => {
  const grouped = new Map<string, SleepSession[]>();
  if (!ids.length) return grouped;
  const rows = await tx.select().from(sleepSessions).where(inArray(sleepSessions.sleepRecordId, ids)).orderBy(...sessionOrder);
  for (const row of rows) {
    const group = grouped.get(row.sleepRecordId) ?? [];
    group.push(row);
    grouped.set(row.sleepRecordId, group);
  }
  return grouped;
};
const insertSessions = async (tx: Transaction, row: SleepRow, input: SleepRecordInput) => {
  if (input.detailMode === "sessions") {
    await tx.insert(sleepSessions).values(input.sessions.map((session) => valuesFromSessionInput(session, row.id)));
    return (await loadSessions(tx, [row.id])).get(row.id)!;
  }
  return [];
};

export const createSleepRecordRepository = (database: typeof db): SleepRecordRepository => ({
  async create(input) {
    input = createSleepRecordSchema.parse(input);
    try {
      return await database.transaction(async (tx) => {
        const [row] = await tx.insert(sleepRecords).values(valuesFromSleepInput(input)).returning();
        return publicRecord(row!, await insertSessions(tx, row!, input));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new SleepRecordConflictError();
      throw error;
    }
  },
  async list(query?: DateRangeQuery) {
    // One snapshot prevents a mode change between parent and child reads.
    return database.transaction(async (tx) => {
      const conditions = [];
      if (query?.from) conditions.push(gte(sleepRecords.sleepDate, query.from));
      if (query?.to) conditions.push(lte(sleepRecords.sleepDate, query.to));
      const where = conditions.length ? and(...conditions) : undefined;
      const rows = await tx.select().from(sleepRecords).where(where).orderBy(desc(sleepRecords.sleepDate));
      const sessions = await loadSessions(tx, rows.map(({ id }) => id));
      return rows.map((row) => publicRecord(row, sessions.get(row.id) ?? []));
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  },
  async findById(id) {
    return database.transaction(async (tx) => {
      const [row] = await tx.select().from(sleepRecords).where(eq(sleepRecords.id, id)).limit(1);
      if (!row) return undefined;
      return publicRecord(row, (await loadSessions(tx, [id])).get(id) ?? []);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  },
  async update(id, input) {
    input = updateSleepRecordSchema.parse(input);
    try {
      return await database.transaction(async (tx) => {
        const [existing] = await tx.select().from(sleepRecords).where(eq(sleepRecords.id, id)).for("update");
        if (!existing) return undefined;
        if (existing.detailMode === "sessions" && input.detailMode === undefined) {
          throw new AppError(400, "VALIDATION_ERROR", "Replacing sessions with nightly measurements requires an explicit detailMode and nightly values");
        }
        const [row] = await tx.update(sleepRecords).set({ ...valuesFromSleepInput(input), updatedAt: new Date() }).where(eq(sleepRecords.id, id)).returning();
        await tx.delete(sleepSessions).where(eq(sleepSessions.sleepRecordId, id));
        return publicRecord(row!, await insertSessions(tx, row!, input));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new SleepRecordConflictError();
      throw error;
    }
  },
  async delete(id) {
    const deleted = await database.delete(sleepRecords).where(eq(sleepRecords.id, id)).returning({ id: sleepRecords.id });
    return deleted.length > 0;
  },
});

export const sleepRecordRepository = createSleepRecordRepository(db);
