import { describe, expect, it } from "vitest";
import { createMonthlySleepSchema, monthlySleepParamsSchema, monthlySleepValuesSchema } from "../src/sleep-monthly-averages/schemas.js";
import { calculateMonthlyReports } from "../src/reports/calculations.js";
import { ReportingService } from "../src/reports/service.js";
import type { ReportData } from "../src/reports/types.js";
import { metricDetail } from "../../web/src/report-format.js";

const entered = { year: 2025, month: 1, averageTotalSleepMinutes: 480, averageDeepMinutes: 100, averageLightMinutes: 270, averageRemMinutes: 111 };
const day = { sleepDate: "2025-01-01", totalSleepMinutes: 400, awakeMinutes: 20, awakeCount: 2, lightMinutes: 200, deepMinutes: 80, remMinutes: 120, sleepScore: 85 };
const data = (): ReportData => ({ weights: [], bloodPressures: [], sleepRecords: [], papRecords: [] });
const keys = ["averageTotalSleepMinutes", "averageDeepMinutes", "averageLightMinutes", "averageRemMinutes"] as const;
describe("monthly Sleep validation", () => {
  it("accepts zero and rounding differences, defaults source, and requires all four values", () => {
    expect(createMonthlySleepSchema.parse({ ...entered, averageRemMinutes: 0 }).source).toBe("manual");
    for (const key of keys) expect(createMonthlySleepSchema.safeParse({ ...entered, [key]: undefined }).success).toBe(false);
    expect(monthlySleepValuesSchema.safeParse(entered).success).toBe(false); // PUT cannot move months
  });
  it.each([-1, 1441, 1.5, null, "480", NaN])("rejects duration %s", (value) => {
    for (const key of keys) expect(createMonthlySleepSchema.safeParse({ ...entered, [key]: value }).success).toBe(false);
  });
  it.each([{ year: 1899 }, { year: 10000 }, { year: 2025.5 }, { month: 0 }, { month: 13 }, { month: 1.5 }, { notes: "x".repeat(2001) }, { source: " " }, { papUsageMinutes: 20 }])("rejects malformed input %j", (change) => {
    expect(createMonthlySleepSchema.safeParse({ ...entered, ...change }).success).toBe(false);
  });
  it.each(["2025/0", "2025/13", "2025/1.0", "2025/1e0", "abcd/1", "1899/1"])("rejects malformed route %s", (path) => {
    const [year, month] = path.split("/"); expect(monthlySleepParamsSchema.safeParse({ year, month }).success).toBe(false);
  });
});
describe("monthly Sleep reporting precedence", () => {
  it.each([0, 2, 31])("selects the entire entered bundle with %i daily records, without blending or mutation", (count) => {
    const source = data(); source.sleepRecords = Array.from({ length: count }, (_, index) => ({ ...day, sleepDate: `2025-01-${String(index + 1).padStart(2, "0")}` }));
    const original = structuredClone(source);
    const dailyReport = calculateMonthlyReports(["2025-01"], source)[0]!;
    source.sleepMonthlyAverages = [entered];
    const report = calculateMonthlyReports(["2025-01"], source)[0]!;
    for (const key of keys) expect(report.sleep[key]).toEqual({ value: entered[key], source: "monthly-average", sampleCount: null, dailyRecordCount: count });
    expect(report.sleep.dailyRecordCount).toBe(count);
    for (const key of ["averageSleepScore", "averageAwakeMinutes", "averageAwakeCount", "stageCoverage"] as const) expect(report.sleep[key]).toEqual(dailyReport.sleep[key]);
    expect(report.pap).toEqual(dailyReport.pap);
    expect(source.sleepRecords).toEqual(original.sleepRecords);
    source.sleepMonthlyAverages = [];
    expect(calculateMonthlyReports(["2025-01"], source)[0]).toEqual(dailyReport);
  });
  it("preserves independently known daily stages and no-data months", () => {
    const source = data(); source.sleepRecords = [{ ...day, remMinutes: null }];
    const [daily, empty] = calculateMonthlyReports(["2025-01", "2025-02"], source);
    expect(daily!.sleep.averageTotalSleepMinutes).toEqual({ value: 400, sampleCount: 1, source: "daily" });
    expect(daily!.sleep.averageRemMinutes.source).toBe("none");
    for (const key of keys) expect(empty!.sleep[key]).toEqual({ value: null, sampleCount: null, source: "none" });
    expect(empty!.sleep.dailyRecordCount).toBe(0);
  });
  it("compares mixed sources by calendar month and leaves PAP unchanged", async () => {
    const source = data(); source.sleepMonthlyAverages = [entered];
    source.sleepRecords = [{ ...day, sleepDate: "2025-02-01" }, { ...day, sleepDate: "2026-01-01" }];
    source.papRecords = [{ therapyDate: "2025-01-01", healthDate: null, usageMinutes: 450, eventsPerHour: 2, maskSealScore: 10, maskOnOffCount: 1, totalScore: 80 }];
    const result = await new ReportingService({ load: async () => source }).yearOverYear([2025, 2026]);
    expect(result[0]!.months).toHaveLength(12);
    expect(result[0]!.months.slice(0, 3).map(m => m.sleep.averageTotalSleepMinutes.source)).toEqual(["monthly-average", "daily", "none"]);
    expect(result[1]!.months[0]!.sleep.averageTotalSleepMinutes.source).toBe("daily");
    expect(result[0]!.months[0]!.pap.averageUsageMinutes).toEqual({ value: 450, source: "daily", sampleCount: 1 });
    expect(metricDetail(result[0]!.months[0]!.sleep.averageTotalSleepMinutes)).toBe("Monthly average · 0 daily records present, not included");
  });
});
