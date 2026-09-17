import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { ReportingService } from "../src/reports/service.js";
import type { ReportData, ReportingDataSource } from "../src/reports/types.js";
import { formatReportValue, metricDetail, sourceLabel } from "../web/report-format.js";

const data = (overrides: Partial<ReportData> = {}): ReportData => ({
  weights: [
    { measuredOn: "2025-01-02", weightKg: 80 }, { measuredOn: "2025-01-20", weightKg: 84 }, { measuredOn: "2025-01-31", weightKg: 82 },
  ],
  bloodPressures: [
    { measuredAt: new Date("2025-01-01T08:00:00Z"), systolic: 120, diastolic: 80, pulse: null },
    { measuredAt: new Date("2025-01-01T18:00:00Z"), systolic: 140, diastolic: 90, pulse: 60 },
    { measuredAt: new Date("2025-01-02T10:00:00Z"), systolic: 110, diastolic: 70, pulse: 80 },
  ],
  sleepRecords: [
    { sleepDate: "2025-01-03", totalSleepMinutes: 420, awakeMinutes: null, lightMinutes: 240, deepMinutes: 80, remMinutes: null, sleepScore: 80 },
    { sleepDate: "2025-01-04", totalSleepMinutes: 480, awakeMinutes: 20, lightMinutes: 260, deepMinutes: 90, remMinutes: null, sleepScore: null },
  ],
  papRecords: [
    { therapyDate: "2025-01-02", healthDate: "2025-01-03", usageMinutes: 420, eventsPerHour: null, maskSealScore: 18, maskOnOffCount: null, totalScore: 90 },
    { therapyDate: "2025-01-03", healthDate: "2025-01-04", usageMinutes: 480, eventsPerHour: null, maskSealScore: null, maskOnOffCount: 2, totalScore: null },
  ],
  ...overrides,
});
const source = (value = data()): ReportingDataSource => ({ load: vi.fn().mockResolvedValue(value) });

describe("reporting service", () => {
  it("calculates weight statistics and chronological month ranges", async () => {
    const service = new ReportingService(source()); const months = await service.monthly("2025-01", "2025-02");
    expect(months.map(({ month }) => month)).toEqual(["2025-01", "2025-02"]);
    expect(months[0]!.weight).toMatchObject({ average: { value: 82, sampleCount: 3 }, minimum: { value: 80 }, maximum: { value: 84 }, first: { value: 80 }, last: { value: 82 }, measurementCount: 3 });
    expect(months[1]!.weight).toBeNull();
  });
  it("averages blood pressure per day before weighting the month", async () => {
    const report = (await new ReportingService(source()).monthly("2025-01", "2025-01"))[0]!.bloodPressure!;
    expect(report.averageSystolic).toMatchObject({ value: 120, sampleCount: 2 });
    expect(report.averageDiastolic.value).toBe(77.5);
    expect(report.averagePulse).toMatchObject({ value: 70, sampleCount: 2 });
    expect(report).toMatchObject({ readingCount: 3, measuredDayCount: 2 });
  });
  it("averages known detailed Sleep values independently", async () => {
    const sleep = (await new ReportingService(source()).monthly("2025-01", "2025-01"))[0]!.sleep;
    expect(sleep.averageTotalSleepMinutes).toEqual({ value: 450, source: "daily", sampleCount: 2 });
    expect(sleep.averageAwakeMinutes).toEqual({ value: 20, source: "daily", sampleCount: 1 });
    expect(sleep.averageRemMinutes).toEqual({ value: null, source: "none", sampleCount: null });
    expect(sleep.averageLightMinutes.value).toBe(250); expect(sleep.averageDeepMinutes.value).toBe(85);
    expect(sleep.averageSleepScore).toEqual({ value: 80, source: "daily", sampleCount: 1 });
  });
  it("uses detailed PAP values and preserves missing values", async () => {
    const pap = (await new ReportingService(source()).monthly("2025-01", "2025-01"))[0]!.pap;
    expect(pap.averageUsageMinutes).toEqual({ value: 450, source: "daily", sampleCount: 2 });
    expect(pap.averageEventsPerHour).toEqual({ value: null, source: "none", sampleCount: null });
    expect(pap.averageMaskSealScore).toEqual({ value: 18, source: "daily", sampleCount: 1 });
    expect(pap.averageMaskOnOffCount).toEqual({ value: 2, source: "daily", sampleCount: 1 });
    expect(typeof pap.averageUsageMinutes.value).toBe("number");
    const empty = (await new ReportingService(source(data({ papRecords: [] }))).monthly("2025-01", "2025-01"))[0]!.pap.averageEventsPerHour;
    expect(empty).toEqual({ value: null, source: "none", sampleCount: null });
  });
  it("groups daily PAP by Health date across month and year boundaries", async () => {
    const papRecords = [
      { therapyDate: "2026-08-31", healthDate: "2026-09-01", usageMinutes: 420, eventsPerHour: 1.5, maskSealScore: null, maskOnOffCount: null, totalScore: null },
      { therapyDate: "2026-12-31", healthDate: "2027-01-01", usageMinutes: 480, eventsPerHour: 0, maskSealScore: null, maskOnOffCount: null, totalScore: null },
    ];
    const reports = await new ReportingService(source(data({ papRecords }))).monthly("2026-08", "2027-01");
    expect(reports[0]!.pap.averageUsageMinutes.value).toBeNull(); expect(reports[1]!.pap.averageUsageMinutes.value).toBe(420);
    expect(reports[4]!.pap.averageUsageMinutes.value).toBeNull(); expect(reports[5]!.pap.averageUsageMinutes.value).toBe(480); expect(reports[5]!.pap.averageEventsPerHour.value).toBe(0);
  });
  it("falls back to Therapy date for legacy PAP", async () => {
    const legacy = { therapyDate: "2026-08-31", healthDate: null, usageMinutes: 300, eventsPerHour: null, maskSealScore: null, maskOnOffCount: null, totalScore: null };
    const reports = await new ReportingService(source(data({ papRecords: [legacy] }))).monthly("2026-08", "2026-09");
    expect(reports[0]!.pap.averageUsageMinutes).toMatchObject({ value: 300, source: "daily" }); expect(reports[1]!.pap.averageUsageMinutes).toMatchObject({ value: null, source: "none" }); expect(legacy.healthDate).toBeNull();
  });
  it("does not shift calendar dates", async () => {
    const report = await new ReportingService(source(data({ weights: [{ measuredOn: "2025-02-01", weightKg: 81 }], bloodPressures: [], sleepRecords: [], papRecords: [] }))).monthly("2025-01", "2025-02");
    expect(report[0]!.weight).toBeNull(); expect(report[1]!.weight!.average.value).toBe(81); expect(report[1]!.sleep.averageRemMinutes.value).toBeNull();
  });
  it("returns January through December for deduplicated year inputs", async () => {
    const reportingSource = source(data({ weights: [], bloodPressures: [], sleepRecords: [], papRecords: [] }));
    const series = await new ReportingService(reportingSource).yearOverYear([2024, 2025]);
    expect(series.map(({ year }) => year)).toEqual([2024, 2025]); expect(series[0]!.months).toHaveLength(12); expect(series[0]!.months[0]!.month).toBe("2024-01"); expect(series[1]!.months[11]!.month).toBe("2025-12");
    expect(reportingSource.load).toHaveBeenCalledTimes(1);
  });
});

describe("report routes", () => {
  const repositories = Array.from({ length: 4 }, () => ({ create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() }));
  const app = (reportingSource = source(data({ weights: [], bloodPressures: [], sleepRecords: [], papRecords: [] }))) => createApp(repositories[0] as never, repositories[1] as never, repositories[2] as never, repositories[3] as never, new ReportingService(reportingSource));
  it("returns monthly metadata and includes empty months across a year boundary", async () => { const response = await request(app()).get("/api/reports/monthly?from=2024-12&to=2025-01"); expect(response.status).toBe(200); expect(response.body.meta).toMatchObject({ from: "2024-12", to: "2025-01", monthCount: 2 }); expect(response.body.months.map((item: { month: string }) => item.month)).toEqual(["2024-12", "2025-01"]); });
  it.each(["from=bad&to=2025-01", "from=2025-02&to=2025-01", "from=2000-01&to=2010-01", "to=2025-01"])("rejects invalid monthly query %s", async (query) => { const response = await request(app()).get(`/api/reports/monthly?${query}`); expect(response.status).toBe(400); expect(response.body.error.code).toBe("VALIDATION_ERROR"); });
  it("deduplicates and sorts years", async () => { const response = await request(app()).get("/api/reports/year-over-year?years=2025,2024,2025"); expect(response.status).toBe(200); expect(response.body.meta.years).toEqual([2024, 2025]); expect(response.body.series[0].months).toHaveLength(12); });
  it.each(["", "2024,nope", "2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020"])("rejects invalid years %s", async (years) => { expect((await request(app()).get(`/api/reports/year-over-year?years=${years}`)).status).toBe(400); });
});

describe("report presentation helpers", () => {
  it("formats units and preserves missing values", () => { expect(formatReportValue(null, "weight")).toBe("—"); expect(formatReportValue(82, "weight")).toBe("82.00 kg"); expect(formatReportValue(444, "duration")).toBe("7 h 24 min"); expect(formatReportValue(122, "pressure")).toBe("122.0 mmHg"); });
  it("provides textual source and sample details", () => { expect(sourceLabel("daily")).toBe("Daily"); expect(metricDetail({ value: 2.3, source: "daily", sampleCount: 4 })).toBe("Daily · n=4"); expect(metricDetail({ value: null, source: "none", sampleCount: null })).toBe("No data"); });
});
