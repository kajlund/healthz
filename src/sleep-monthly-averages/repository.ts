import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sleepMonthlyAverages } from "../db/schema.js";
import { AppError } from "../errors.js";
import type { MonthlySleepInput, MonthlySleepValues } from "./schemas.js";

export type MonthlySleepAverage = typeof sleepMonthlyAverages.$inferSelect;
const uniqueViolation = (error: unknown): boolean => typeof error === "object" && error !== null &&
  (("code" in error && error.code === "23505") || ("cause" in error && uniqueViolation(error.cause)));
export const createMonthlySleepRepository = (database: typeof db) => {
  const selected = (year: number, month: number) => and(eq(sleepMonthlyAverages.year, year), eq(sleepMonthlyAverages.month, month));
  return {
    async create(input: MonthlySleepInput) {
      try { return (await database.insert(sleepMonthlyAverages).values(input).returning())[0]!; }
      catch (error) {
        if (uniqueViolation(error)) throw new AppError(409, "CONFLICT", "A monthly sleep average already exists for this month.");
        throw error;
      }
    },
    async list(year?: number) {
      return database.select().from(sleepMonthlyAverages).where(year === undefined ? undefined : eq(sleepMonthlyAverages.year, year)).orderBy(asc(sleepMonthlyAverages.year), asc(sleepMonthlyAverages.month));
    },
    async get(year: number, month: number) { return (await database.select().from(sleepMonthlyAverages).where(selected(year, month)))[0]; },
    async update(year: number, month: number, input: MonthlySleepValues) {
      return (await database.update(sleepMonthlyAverages).set({ ...input, notes: input.notes ?? null, updatedAt: new Date() }).where(selected(year, month)).returning())[0];
    },
    async delete(year: number, month: number) {
      return (await database.delete(sleepMonthlyAverages).where(selected(year, month)).returning({ id: sleepMonthlyAverages.id })).length > 0;
    },
  };
};
export type MonthlySleepRepository = ReturnType<typeof createMonthlySleepRepository>;
