import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createDashboardRouter } from "../src/dashboard/router.js";
import { DashboardService, shiftMonth } from "../src/dashboard/service.js";
import type { DashboardLatestSource } from "../src/dashboard/types.js";
import type { MonthlyReport } from "../src/reports/types.js";

const metric = (value: number | null, source: "daily" | "monthly-summary" | "none" = value === null ? "none" : "daily") => ({ value, source, sampleCount: value === null ? null : 1 });
const report = (month: string, value: number | null): MonthlyReport => ({ month, weight: value === null ? null : { average: metric(value), minimum: metric(value), maximum: metric(value), first: metric(value), last: metric(value), measurementCount: 1 }, bloodPressure: null, sleep: { averageTotalSleepMinutes: metric(null), averageAwakeMinutes: metric(null), averageLightMinutes: metric(null), averageDeepMinutes: metric(null), averageRemMinutes: metric(90, "monthly-summary"), averageSleepScore: metric(null) }, pap: { averageUsageMinutes: metric(null), averageEventsPerHour: metric(0), averageMaskSealScore: metric(null), averageMaskOnOffCount: metric(null), averageTotalScore: metric(null) } });
const months = Array.from({ length: 12 }, (_, index) => { const date = new Date(2024, 1 + index, 1, 12); return report(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, index === 11 ? 82.5 : null); });
const latest = { weight: { measuredOn: "2026-01-01", weightKg: 82.5 }, bloodPressure: { measuredAt: new Date("2026-01-02T10:00:00Z"), systolic: 120, diastolic: 80, pulse: null }, sleep: { sleepDate: "2026-01-03", totalSleepMinutes: 440, sleepScore: null }, pap: { therapyDate: "2026-01-04", usageMinutes: null, eventsPerHour: 0, totalScore: null } };

describe("dashboard service", () => {
  it("calculates previous and twelve-month ranges across a year boundary", async () => { const monthly = vi.fn().mockResolvedValue(months); const service = new DashboardService({ monthly } as never, { load: vi.fn().mockResolvedValue(latest) }); const result = await service.get("2025-01"); expect(shiftMonth("2025-01", -1)).toBe("2024-12"); expect(monthly).toHaveBeenCalledWith("2024-02", "2025-01"); expect(result.trend).toHaveLength(12); expect(result.previousMonthData.month).toBe("2024-12"); expect(result.currentMonth.weight?.average.value).toBe(82.5); expect(result.currentMonth.pap.averageEventsPerHour.value).toBe(0); expect(result.currentMonth.sleep.averageRemMinutes.source).toBe("monthly-summary"); });
  it("returns null latest records unchanged", async () => { const emptyLatest: DashboardLatestSource = { load: vi.fn().mockResolvedValue({ weight: null, bloodPressure: null, sleep: null, pap: null }) }; const result = await new DashboardService({ monthly: vi.fn().mockResolvedValue(months) } as never, emptyLatest).get("2025-01"); expect(result.latest).toEqual({ weight: null, bloodPressure: null, sleep: null, pap: null }); });
});

describe("dashboard route", () => {
  const app = () => { const value = new DashboardService({ monthly: vi.fn().mockResolvedValue(months) } as never, { load: vi.fn().mockResolvedValue(latest) }); const app = express(); app.use("/api/dashboard", createDashboardRouter(value)); app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(400).json({ error })); return app; };
  it("returns a valid reference month", async () => { const response = await request(app()).get("/api/dashboard?month=2025-01"); expect(response.status).toBe(200); expect(response.body).toMatchObject({ referenceMonth: "2025-01", previousMonth: "2024-12" }); expect(typeof response.body.latest.weight.weightKg).toBe("number"); });
  it.each(["", "2025-13", "bad", "2025-1"])("rejects invalid month %s", async (month) => { expect((await request(app()).get(`/api/dashboard?month=${month}`)).status).toBe(400); });
});
