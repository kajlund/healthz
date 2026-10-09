import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createMonthlySleepRepository } from "../src/sleep-monthly-averages/repository.js";
import { createReportingDataSource } from "../src/reports/data-source.js";
import { ReportingService } from "../src/reports/service.js";
import { createSleepRecordRepository } from "../src/sleep-records/repository.js";

describe.skipIf(process.env.SLEEP_DATABASE_TESTS !== "1")("monthly Sleep PostgreSQL API and reporting", () => {
  const schema = `healthz_monthly_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: env.DATABASE_URL });
  const pool = new Pool({ connectionString: env.DATABASE_URL, options: `-c search_path=${schema}` });
  const db = drizzle(pool);
  const repository = createMonthlySleepRepository(db);
  const reporting = new ReportingService(createReportingDataSource(db));
  const daily = createSleepRecordRepository(db);
  const unused = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = createApp(unused, unused, daily, unused, reporting, undefined, undefined, undefined, undefined, repository);
  const input = { year: 2025, month: 1, averageTotalSleepMinutes: 480, averageDeepMinutes: 90, averageLightMinutes: 270, averageRemMinutes: 121 };
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) {
      const sql = await readFile(new URL(`../drizzle/${tag}.sql`, import.meta.url), "utf8");
      if (tag === "0009_sleep_monthly_averages") expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|DROP|ALTER)\b/i);
      await pool.query(sql.replaceAll('"public".', `"${schema}".`));
    }
  });
  afterAll(async () => { await pool.end(); if (!/^healthz_monthly_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe schema"); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); });
  it("creates, retrieves, updates, conflicts, deletes and restores reports without touching daily sessions", async () => {
    const original = await daily.create({ sleepDate: "2025-01-01", source: "manual", detailMode: "sessions", sleepScore: 80, sessions: [{ sessionType: "main-sleep", totalSleepMinutes: 400, awakeMinutes: 20, awakeCount: 2, lightMinutes: 200, deepMinutes: 80, remMinutes: 120, sortOrder: 0 }, { sessionType: "nap", totalSleepMinutes: 20, sortOrder: 1 }] });
    const before = await reporting.monthly("2025-01", "2025-02");
    const created = await request(app).post("/api/sleep-monthly-averages").send(input).expect(201);
    expect(created.body).toMatchObject({ ...input, source: "manual", notes: null });
    expect(created.body.id).toMatch(/^[a-f0-9-]{36}$/);
    await request(app).post("/api/sleep-monthly-averages").send(input).expect(409);
    await expect(db.execute(`INSERT INTO sleep_monthly_averages (year,month,average_total_sleep_minutes,average_deep_minutes,average_light_minutes,average_rem_minutes) VALUES (2025,1,1,1,1,1)`)).rejects.toThrow();
    const get = await request(app).get("/api/sleep-monthly-averages/2025/01").expect(200);
    expect(get.body).toEqual(created.body);
    const { year: _year, month: _month, ...values } = input;
    await request(app).put("/api/sleep-monthly-averages/2025/1").send({ ...values, averageTotalSleepMinutes: 490 }).expect(200);
    await request(app).put("/api/sleep-monthly-averages/2025/1").send({ ...input, month: 2 }).expect(400);
    await request(app).put("/api/sleep-monthly-averages/2025/2").send(values).expect(404);
    const report = (await reporting.monthly("2025-01", "2025-02"))[0]!.sleep;
    expect(report.averageTotalSleepMinutes).toEqual({ value: 490, source: "monthly-average", sampleCount: null, dailyRecordCount: 1 });
    expect(report.averageSleepScore).toEqual(before[0]!.sleep.averageSleepScore);
    expect(report.averageAwakeMinutes).toEqual(before[0]!.sleep.averageAwakeMinutes);
    expect(report.stageCoverage).toEqual(before[0]!.sleep.stageCoverage);
    expect(await daily.findById(original.id)).toEqual(original);
    expect((await daily.list())[0]!.sessions).toHaveLength(2);
    await request(app).delete("/api/sleep-monthly-averages/2025/1").expect(204);
    await request(app).get("/api/sleep-monthly-averages/2025/1").expect(404);
    await request(app).delete("/api/sleep-monthly-averages/2025/1").expect(404);
    expect(await reporting.monthly("2025-01", "2025-02")).toEqual(before);
    expect(await daily.findById(original.id)).toEqual(original);
  });
  it("orders chronologically, filters by year and isolates deletion", async () => {
    for (const [year, month] of [[2026, 2], [2025, 12], [2026, 1]]) await request(app).post("/api/sleep-monthly-averages").send({ ...input, year, month }).expect(201);
    const all = await request(app).get("/api/sleep-monthly-averages").expect(200);
    expect(all.body.map((r: { year: number; month: number }) => [r.year, r.month])).toEqual([[2025, 12], [2026, 1], [2026, 2]]);
    expect((await request(app).get("/api/sleep-monthly-averages?year=2026").expect(200)).body).toHaveLength(2);
    await request(app).delete("/api/sleep-monthly-averages/2026/1").expect(204);
    await request(app).get("/api/sleep-monthly-averages/2026/2").expect(200);
    const report = (await reporting.monthly("2026-02", "2026-02"))[0]!.sleep;
    expect(report.averageTotalSleepMinutes.source).toBe("monthly-average");
    expect(report.dailyRecordCount).toBe(0);
    expect(report.averageSleepScore.source).toBe("none");
  });
  it("returns consistent validation errors and enforces database bounds", async () => {
    for (const url of ["/2025/13", "/2025/1e0", "/1899/1", "?year=oops"]) await request(app).get(`/api/sleep-monthly-averages${url}`).expect(400);
    for (const change of [{ year: 1899 }, { month: 13 }, { averageDeepMinutes: -1 }, { averageLightMinutes: 1441 }, { averageRemMinutes: null }]) await request(app).post("/api/sleep-monthly-averages").send({ ...input, ...change }).expect(400);
    for (const row of ["1899,1,0,0,0,0", "2025,13,0,0,0,0", "2025,2,-1,0,0,0", "2025,2,0,1441,0,0"]) await expect(pool.query(`INSERT INTO sleep_monthly_averages (year,month,average_total_sleep_minutes,average_deep_minutes,average_light_minutes,average_rem_minutes) VALUES (${row})`)).rejects.toThrow();
  });
});
