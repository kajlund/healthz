import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { monthlySleepSummaries } from "../db/schema.js";
import { MonthlySleepSummaryConflictError } from "../errors.js";
import type { MonthlySleepSummaryInput } from "./schemas.js";

type StoredSummary = typeof monthlySleepSummaries.$inferSelect;
export type MonthlySleepSummary = Omit<StoredSummary, "summaryMonth"> & { summaryMonth: string };
export interface MonthlySleepSummaryRepository { create(input: MonthlySleepSummaryInput): Promise<MonthlySleepSummary>; list(): Promise<MonthlySleepSummary[]>; findById(id: string): Promise<MonthlySleepSummary | undefined>; update(id: string, input: MonthlySleepSummaryInput): Promise<MonthlySleepSummary | undefined>; delete(id: string): Promise<boolean>; }
const isUniqueViolation = (error: unknown): boolean => { if (typeof error !== "object" || error === null) return false; if ("code" in error && error.code === "23505") return true; return "cause" in error && isUniqueViolation(error.cause); };
export const valuesFromMonthlySleepInput = (input: MonthlySleepSummaryInput) => ({ ...input, summaryMonth: `${input.summaryMonth}-01`, averageTotalSleepMinutes: input.averageTotalSleepMinutes ?? null, averageAwakeMinutes: input.averageAwakeMinutes ?? null, averageLightMinutes: input.averageLightMinutes ?? null, averageDeepMinutes: input.averageDeepMinutes ?? null, averageRemMinutes: input.averageRemMinutes ?? null, averageSleepScore: input.averageSleepScore ?? null, daysRecorded: input.daysRecorded ?? null, notes: input.notes ?? null });
const fromStored = (summary: StoredSummary): MonthlySleepSummary => ({ ...summary, summaryMonth: summary.summaryMonth.slice(0, 7) });
export const monthlySleepSummaryRepository: MonthlySleepSummaryRepository = {
  async create(input) { try { const [summary] = await db.insert(monthlySleepSummaries).values(valuesFromMonthlySleepInput(input)).returning(); return fromStored(summary!); } catch (error) { if (isUniqueViolation(error)) throw new MonthlySleepSummaryConflictError(); throw error; } },
  async list() { return (await db.select().from(monthlySleepSummaries).orderBy(desc(monthlySleepSummaries.summaryMonth))).map(fromStored); },
  async findById(id) { const [summary] = await db.select().from(monthlySleepSummaries).where(eq(monthlySleepSummaries.id, id)).limit(1); return summary ? fromStored(summary) : undefined; },
  async update(id, input) { try { const [summary] = await db.update(monthlySleepSummaries).set({ ...valuesFromMonthlySleepInput(input), updatedAt: new Date() }).where(eq(monthlySleepSummaries.id, id)).returning(); return summary ? fromStored(summary) : undefined; } catch (error) { if (isUniqueViolation(error)) throw new MonthlySleepSummaryConflictError(); throw error; } },
  async delete(id) { return (await db.delete(monthlySleepSummaries).where(eq(monthlySleepSummaries.id, id)).returning({ id: monthlySleepSummaries.id })).length > 0; },
};
