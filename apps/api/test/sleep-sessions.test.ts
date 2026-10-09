import { describe, expect, it } from "vitest";
import { createSleepRecordSchema, sleepSessionSchema, type SleepSessionInput } from "../src/sleep-records/schemas.js";
import { aggregateSessions, stageCoverage, valuesFromSleepInput } from "../src/sleep-records/service.js";
import { calculateMonthlyReports } from "../src/reports/calculations.js";

const nap: SleepSessionInput = { sessionType: "nap", totalSleepMinutes: 30, sortOrder: 1 };
const main: SleepSessionInput = { sessionType: "main-sleep", totalSleepMinutes: 420, sortOrder: 0, awakeMinutes: 20, awakeCount: 0, lightMinutes: 240, deepMinutes: 80, remMinutes: 100 };
const day = { sleepDate: "2026-09-15", source: "manual", detailMode: "sessions", sessions: [main, nap] };

describe("sleep session validation and aggregates", () => {
  it("accepts duration-only naps, complete stages, and zero awakenings", () => {
    expect(sleepSessionSchema.parse(nap)).toEqual(nap);
    expect(sleepSessionSchema.parse(main)).toEqual(main);
    expect(createSleepRecordSchema.parse({ sleepDate: day.sleepDate, source: "manual", totalSleepMinutes: 400, awakeCount: 0 })).toMatchObject({ awakeCount: 0 });
  });
  it.each([-1, 0.5, 2_147_483_648])("rejects invalid awakeCount %s in both modes", (awakeCount) => {
    expect(sleepSessionSchema.safeParse({ ...nap, awakeCount }).success).toBe(false);
    expect(createSleepRecordSchema.safeParse({ sleepDate: day.sleepDate, source: "manual", totalSleepMinutes: 400, awakeCount }).success).toBe(false);
  });
  it.each([
    { sessionType: "unknown" }, { totalSleepMinutes: 0 }, { totalSleepMinutes: -1 }, { totalSleepMinutes: 1.5 },
    { awakeMinutes: -1 }, { lightMinutes: -1 }, { deepMinutes: -1 }, { remMinutes: -1 }, { sortOrder: -1 }, { sortOrder: 0.1 },
    { startedAt: "2026-09-15" }, { startedAt: "2026-09-15T01:00:00" },
    { startedAt: "2026-09-15T01:00:00Z", endedAt: "2026-09-15T01:00:00Z" },
    { startedAt: "2026-09-15T01:00:00Z", endedAt: "2026-09-15T00:00:00Z" },
  ])("rejects invalid session %j", (change) => expect(sleepSessionSchema.safeParse({ ...nap, ...change }).success).toBe(false));
  it("compares timestamps by instant and permits independent durations and stages", () => {
    expect(sleepSessionSchema.safeParse({ ...main, startedAt: "2026-09-14T23:00:00+03:00", endedAt: "2026-09-15T06:30:00+03:00", lightMinutes: 1 }).success).toBe(true);
    expect(sleepSessionSchema.safeParse({ ...nap, startedAt: "2026-09-15T10:00:00+03:00", endedAt: "2026-09-15T08:00:00Z" }).success).toBe(true);
    expect(sleepSessionSchema.safeParse({ ...nap, endedAt: "2026-09-15T08:00:00Z" }).success).toBe(true);
  });
  it("rejects missing sessions and nonempty summary sessions", () => {
    for (const sessions of [undefined, []]) expect(createSleepRecordSchema.safeParse({ ...day, sessions }).success).toBe(false);
    expect(createSleepRecordSchema.safeParse({ ...day, detailMode: "summary", totalSleepMinutes: 450 }).success).toBe(false);
    expect(createSleepRecordSchema.safeParse({ ...day, detailMode: undefined, totalSleepMinutes: 450 }).success).toBe(false);
  });
  it.each(["totalSleepMinutes", "awakeMinutes", "awakeCount", "lightMinutes", "deepMinutes", "remMinutes"])("rejects submitted session aggregate %s", (key) => {
    expect(createSleepRecordSchema.safeParse({ ...day, [key]: 1 }).success).toBe(false);
  });
  it("requires explicit summary total on conversion", () => {
    expect(createSleepRecordSchema.safeParse({ sleepDate: day.sleepDate, source: "manual", detailMode: "summary" }).success).toBe(false);
  });
  it("sums complete data and retains zero", () => {
    expect(aggregateSessions([main, main])).toEqual({ totalSleepMinutes: 840, awakeMinutes: 40, awakeCount: 0, lightMinutes: 480, deepMinutes: 160, remMinutes: 200 });
  });
  it("makes each incomplete measurement null independently", () => {
    expect(aggregateSessions([main, nap])).toEqual({ totalSleepMinutes: 450, awakeMinutes: null, awakeCount: null, lightMinutes: null, deepMinutes: null, remMinutes: null });
    expect(aggregateSessions([main, { ...nap, awakeCount: 2, lightMinutes: 20, deepMinutes: null }])).toMatchObject({ awakeCount: 2, lightMinutes: 260, deepMinutes: null });
  });
  it("rejects aggregate storage overflow without imposing the summary 24-hour limit on sessions", () => {
    expect(createSleepRecordSchema.safeParse({ ...day, sessions: [{ ...nap, totalSleepMinutes: 2_147_483_647 }, nap] }).success).toBe(false);
    expect(createSleepRecordSchema.safeParse({ ...day, sessions: [{ ...nap, totalSleepMinutes: 1500 }] }).success).toBe(true);
  });
  it("derives coverage from stages including zero and excludes Awake", () => {
    expect(stageCoverage([main])).toBe("complete");
    expect(stageCoverage([{ lightMinutes: 0, deepMinutes: 0, remMinutes: 0 }])).toBe("complete");
    expect(stageCoverage([main, nap])).toBe("partial");
    expect(stageCoverage([{ lightMinutes: 1 }])).toBe("partial");
    expect(stageCoverage([nap])).toBe("none");
    expect(stageCoverage([])).toBe("none");
  });
  it("preserves summary measurements and does not calculate sleepScore", () => {
    const old = { sleepDate: day.sleepDate, source: "manual", totalSleepMinutes: 444, awakeMinutes: 31, lightMinutes: 250, deepMinutes: 90, remMinutes: 100, sleepScore: 86, notes: "Rested" };
    expect(valuesFromSleepInput(createSleepRecordSchema.parse(old))).toEqual({ ...old, detailMode: "summary", awakeCount: null });
    expect(valuesFromSleepInput(createSleepRecordSchema.parse(day)).sleepScore).toBeNull();
  });
  it("reports session totals, preserves missing stages", () => {
    const parent = valuesFromSleepInput(createSleepRecordSchema.parse(day));
    const data = { weights: [], bloodPressures: [], sleepRecords: [parent], papRecords: [] };
    const report = calculateMonthlyReports(["2026-09"], data)[0]!.sleep;
    expect(report.averageTotalSleepMinutes).toEqual({ value: 450, source: "daily", sampleCount: 1 });
    expect(report.averageLightMinutes).toEqual({ value: null, source: "none", sampleCount: null });
    expect(parent.lightMinutes).toBeNull();
  });
});
