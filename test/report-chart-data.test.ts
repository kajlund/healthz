import { describe, expect, it } from "vitest";
import type { MonthlyReport, ReportMetric, YearReportResponse } from "../web/api.js";
import { choiceFor, hasValues, metricDataset, metricsFor, monthLabels, pointStyleFor, validMetricKey, yearSeriesData } from "../web/report-chart-data.js";
import { formatReportValue, metricDetail } from "../web/report-format.js";

const metric = (value: number | null, source: ReportMetric["source"] = value === null ? "none" : "daily", sampleCount: number | null = value === null ? null : 1): ReportMetric => ({ value, source, sampleCount });
const month = (name: string, weight: number | null, source: ReportMetric["source"] = weight === null ? "none" : "daily"): MonthlyReport => ({
  month: name,
  weight: weight === null ? null : { average: metric(weight, source), minimum: metric(weight, source), maximum: metric(weight, source), first: metric(weight, source), last: metric(weight, source), measurementCount: 1 },
  bloodPressure: null,
  sleep: { averageTotalSleepMinutes: metric(null), averageAwakeMinutes: metric(null), averageLightMinutes: metric(null), averageDeepMinutes: metric(null), averageRemMinutes: metric(null), averageSleepScore: metric(null) },
  pap: { averageUsageMinutes: metric(null), averageEventsPerHour: metric(null), averageMaskSealScore: metric(null), averageMaskOnOffCount: metric(null), averageTotalScore: metric(null) },
});

describe("report chart transformations", () => {
  it("converts report months into localized labels", () => { expect(monthLabels([month("2025-01", 1), month("2025-02", 2)])).toHaveLength(2); expect(monthLabels([month("2025-01", 1)])[0]).toMatch(/2025/); });
  it("preserves null and measured zero", () => { expect(metricDataset("Weight", [metric(null), metric(0)]).data).toEqual([null, 0]); expect(hasValues([metric(null)])).toBe(false); expect(hasValues([metric(0)])).toBe(true); });
  it("selects metrics and safely falls back for invalid URL values", () => { expect(choiceFor("sleep-deep").key).toBe("sleep-deep"); expect(validMetricKey("bad", "sleep-")).toBe("sleep-total"); expect(validMetricKey("pap-events", "pap-")).toBe("pap-events"); expect(validMetricKey("sleep-total", "pap-")).toBe("pap-usage"); });
  it("formats durations and builds tooltip detail", () => { expect(formatReportValue(444, "duration")).toBe("7 h 24 min"); expect(metricDetail(metric(2.4, "monthly-summary", 28))).toContain("n=28"); });
  it("uses distinct point styles for daily and monthly-summary data", () => { expect(pointStyleFor(metric(1, "daily"))).toBe("circle"); expect(pointStyleFor(metric(1, "monthly-summary"))).toBe("rectRot"); });
  it("builds partial year series and omits an entirely empty year", () => { const response: YearReportResponse = { meta: { years: [2023, 2024, 2025], generatedAt: "", monthCount: 36 }, series: [{ year: 2023, months: Array.from({ length: 12 }, (_, i) => month(`2023-${String(i + 1).padStart(2, "0")}`, i === 0 ? 0 : null)) }, { year: 2024, months: Array.from({ length: 12 }, (_, i) => month(`2024-${String(i + 1).padStart(2, "0")}`, i === 5 ? 80 : null, "monthly-summary")) }, { year: 2025, months: Array.from({ length: 12 }, (_, i) => month(`2025-${String(i + 1).padStart(2, "0")}`, null)) }] }; const data = yearSeriesData(response, choiceFor("weight")); expect(data.labels).toHaveLength(12); expect(data.datasets.map((d) => d.label)).toEqual(["2023", "2024"]); expect(data.datasets[0]!.data[0]).toBe(0); expect(data.datasets[1]!.data[5]).toBe(80); expect(metricsFor(response.series[1]!.months, choiceFor("weight"))).toHaveLength(12); });
});
