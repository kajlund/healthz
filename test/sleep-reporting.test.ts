import { describe, expect, it } from "vitest";
import { ReportingService } from "../src/reports/service.js";
import { calculateMonthlyReports } from "../src/reports/calculations.js";
import type { ReportData } from "../src/reports/types.js";
import { stageCoverage, valuesFromSleepInput } from "../src/sleep-records/service.js";
import { choiceFor, metricDataset, yearSeriesData } from "../web/report-chart-data.js";
import { formatChartTick, formatReportValue, stageCoverageDetail } from "../web/report-format.js";
import { latestSleepDetail } from "../web/dashboard-helpers.js";

const empty = (): ReportData => ({ weights: [], bloodPressures: [], sleepRecords: [], papRecords: [], monthlySleep: [], monthlyPap: [] });
const summary = { sleepDate: "2026-09-01", totalSleepMinutes: 420, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 80, remMinutes: 100, sleepScore: 80 };
const monthly = { summaryMonth: "2026-09-01", averageTotalSleepMinutes: 300, averageAwakeMinutes: 12, averageLightMinutes: 200, averageDeepMinutes: 50, averageRemMinutes: 50, averageSleepScore: 70, daysRecorded: 30 };
const sessions = [{ sessionType: "main-sleep" as const, totalSleepMinutes: 420, sortOrder: 0, awakeCount: 2, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 80, remMinutes: 100 }, { sessionType: "nap" as const, totalSleepMinutes: 40, sortOrder: 1 }];
const sessionDay = { ...valuesFromSleepInput({ sleepDate: "2026-09-02", source: "watch", detailMode: "sessions", sessions }), stageCoverage: stageCoverage(sessions) };
const report = (data: ReportData) => calculateMonthlyReports(["2026-09"], data)[0]!.sleep;

describe("multi-session Sleep reporting", () => {
  it("includes zero, excludes unknown, and returns the correct daily sample and precision", () => {
    const result = report({ ...empty(), sleepRecords: [{ ...summary, awakeCount: 0 }, { ...summary, sleepDate: "2026-09-02", awakeCount: 3 }, { ...summary, sleepDate: "2026-09-03", awakeCount: null }] });
    expect(result.averageAwakeCount).toEqual({ value: 1.5, source: "daily", sampleCount: 2 });
    expect(result.averageAwakeMinutes.value).toBe(18);
  });
  it("does not invent an awakenings fallback from monthly summaries", () => {
    for (const sleepRecords of [[], [{ ...summary, awakeCount: null }]]) {
      const result = report({ ...empty(), sleepRecords, monthlySleep: [monthly] });
      expect(result.averageAwakeCount).toEqual({ value: null, source: "none", sampleCount: null });
    }
    expect(report({ ...empty(), monthlySleep: [monthly] }).stageCoverage).toEqual({ completeDays: 0, partialDays: 0, noStageDays: 0 });
  });
  it("uses main sleep plus nap as exactly one observation and never adds children again", () => {
    const result = report({ ...empty(), sleepRecords: [sessionDay] });
    expect(result.averageTotalSleepMinutes).toEqual({ value: 460, source: "daily", sampleCount: 1 });
    expect(result.averageLightMinutes).toEqual({ value: null, source: "none", sampleCount: null });
    expect(result.stageCoverage).toEqual({ completeDays: 0, partialDays: 1, noStageDays: 0 });
    expect(sessionDay.lightMinutes).toBeNull();
  });
  it("counts coverage per day and samples each metric independently", () => {
    const result = report({ ...empty(), sleepRecords: [summary, sessionDay, { ...summary, sleepDate: "2026-09-03", lightMinutes: null, deepMinutes: null, remMinutes: null, stageCoverage: "none" }] });
    expect(result.stageCoverage).toEqual({ completeDays: 1, partialDays: 1, noStageDays: 1 });
    expect(result.averageTotalSleepMinutes.sampleCount).toBe(3);
    expect(result.averageLightMinutes).toEqual({ value: 240, source: "daily", sampleCount: 1 });
    expect(result.averageDeepMinutes.sampleCount).toBe(1);
    expect(result.averageRemMinutes.sampleCount).toBe(1);
  });
  it("retains summary values and metric-specific historical fallback without mutation", () => {
    const old = { ...summary, remMinutes: null };
    const data = { ...empty(), sleepRecords: [old], monthlySleep: [monthly] };
    const before = structuredClone(data);
    const result = report(data);
    expect(result.averageTotalSleepMinutes).toEqual({ value: 420, source: "daily", sampleCount: 1 });
    expect(result.averageLightMinutes).toEqual({ value: 240, source: "daily", sampleCount: 1 });
    expect(result.averageRemMinutes).toEqual({ value: 50, source: "monthly-summary", sampleCount: 30 });
    expect(result.stageCoverage.partialDays).toBe(1);
    expect(data).toEqual(before);
    const partial = report({ ...empty(), sleepRecords: [sessionDay], monthlySleep: [monthly] });
    expect(partial.averageTotalSleepMinutes.value).toBe(460);
    expect(partial.averageLightMinutes).toEqual({ value: 200, source: "monthly-summary", sampleCount: 30 });
  });
  it("compares awakenings year over year, including measured zero and missing months", async () => {
    const service = new ReportingService({ load: async () => ({ ...empty(), sleepRecords: [{ ...summary, sleepDate: "2025-09-01", awakeCount: 0 }, { ...summary, awakeCount: 3 }] }) });
    const series = await service.yearOverYear([2025, 2026]);
    expect(series[0]!.months[8]!.sleep.averageAwakeCount).toEqual({ value: 0, source: "daily", sampleCount: 1 });
    expect(series[1]!.months[8]!.sleep.averageAwakeCount.value).toBe(3);
    const chart = yearSeriesData({ meta: { years: [2025, 2026], generatedAt: "", monthCount: 24 }, series }, choiceFor("sleep-awake-count"));
    expect(chart.datasets.map((dataset) => dataset.data[8])).toEqual([0, 3]);
    expect(chart.datasets[0]!.data[0]).toBeNull();
  });
  it("formats count charts and tables separately from durations", () => {
    expect(choiceFor("sleep-awake-count").label).toBe("Average times awake");
    expect(choiceFor("sleep-awake").label).toBe("Total time awake");
    expect(formatReportValue(1.5, "count")).toBe("1.50 times");
    expect(formatReportValue(0, "count")).toBe("0.00 times");
    expect(formatChartTick(1.5, "count")).toBe("1.50 times");
    expect(formatChartTick(18, "duration")).toBe("0 h 18 min");
    expect(metricDataset("Times awake", [{ value: null, sampleCount: null, source: "none" }, { value: 0, sampleCount: 1, source: "daily" }]).data).toEqual([null, 0]);
    expect(stageCoverageDetail({ completeDays: 1, partialDays: 2, noStageDays: 3 })).toContain("1 complete, 2 partial, 3 without stages");
  });
  it("keeps latest Sleep details compact while including zero awakenings, sessions and naps", () => {
    const latest = { sleepDate: "2026-09-02", totalSleepMinutes: 460, sleepScore: 80, awakeCount: 0, detailMode: "sessions" as const, sessionCount: 2, napCount: 1 };
    expect(latestSleepDetail(latest)).toContain("Times awake: 0");
    expect(latestSleepDetail(latest)).toContain("2 sessions, including 1 nap");
    expect(latestSleepDetail({ ...latest, napCount: 0 })).toContain("with additional sleep");
    expect(latestSleepDetail({ ...latest, detailMode: "summary", awakeCount: null })).not.toContain("Times awake");
    expect(latestSleepDetail({ ...latest, detailMode: "summary" })).not.toContain("sessions");
  });
});
