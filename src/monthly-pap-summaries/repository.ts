import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { monthlyPapSummaries } from "../db/schema.js";
import { MonthlyPapSummaryConflictError } from "../errors.js";
import type { MonthlyPapSummaryInput } from "./schemas.js";

type StoredSummary = typeof monthlyPapSummaries.$inferSelect;
export type MonthlyPapSummary = Omit<StoredSummary, "summaryMonth"> & { summaryMonth: string };
export interface MonthlyPapSummaryRepository { create(input: MonthlyPapSummaryInput): Promise<MonthlyPapSummary>; list(): Promise<MonthlyPapSummary[]>; findById(id: string): Promise<MonthlyPapSummary | undefined>; update(id: string, input: MonthlyPapSummaryInput): Promise<MonthlyPapSummary | undefined>; delete(id: string): Promise<boolean>; }
const isUniqueViolation = (error: unknown): boolean => { if (typeof error !== "object" || error === null) return false; if ("code" in error && error.code === "23505") return true; return "cause" in error && isUniqueViolation(error.cause); };
export const valuesFromMonthlyPapInput = (input: MonthlyPapSummaryInput) => ({ ...input, summaryMonth: `${input.summaryMonth}-01`, averageUsageMinutes: input.averageUsageMinutes ?? null, averageEventsPerHour: input.averageEventsPerHour ?? null, averageMaskSealScore: input.averageMaskSealScore ?? null, averageMaskOnOffCount: input.averageMaskOnOffCount ?? null, averageTotalScore: input.averageTotalScore ?? null, daysRecorded: input.daysRecorded ?? null, notes: input.notes ?? null });
const fromStored = (summary: StoredSummary): MonthlyPapSummary => ({ ...summary, summaryMonth: summary.summaryMonth.slice(0, 7) });
export const monthlyPapSummaryRepository: MonthlyPapSummaryRepository = {
  async create(input) { try { const [summary] = await db.insert(monthlyPapSummaries).values(valuesFromMonthlyPapInput(input)).returning(); return fromStored(summary!); } catch (error) { if (isUniqueViolation(error)) throw new MonthlyPapSummaryConflictError(); throw error; } },
  async list() { return (await db.select().from(monthlyPapSummaries).orderBy(desc(monthlyPapSummaries.summaryMonth))).map(fromStored); },
  async findById(id) { const [summary] = await db.select().from(monthlyPapSummaries).where(eq(monthlyPapSummaries.id, id)).limit(1); return summary ? fromStored(summary) : undefined; },
  async update(id, input) { try { const [summary] = await db.update(monthlyPapSummaries).set({ ...valuesFromMonthlyPapInput(input), updatedAt: new Date() }).where(eq(monthlyPapSummaries.id, id)).returning(); return summary ? fromStored(summary) : undefined; } catch (error) { if (isUniqueViolation(error)) throw new MonthlyPapSummaryConflictError(); throw error; } },
  async delete(id) { return (await db.delete(monthlyPapSummaries).where(eq(monthlyPapSummaries.id, id)).returning({ id: monthlyPapSummaries.id })).length > 0; },
};
