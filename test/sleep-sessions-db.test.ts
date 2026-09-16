import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createSleepRecordRepository, type SleepRecordRepository } from "../src/sleep-records/repository.js";
import { createSleepRecordSchema, type SleepRecordInput } from "../src/sleep-records/schemas.js";
import { calculateMonthlyReports } from "../src/reports/calculations.js";

// Opt in with SLEEP_DATABASE_TESTS=1. All writes target a new disposable schema;
// no existing tables, source exports, or records are read or changed.
describe.skipIf(process.env.SLEEP_DATABASE_TESTS !== "1")("Sleep PostgreSQL integration", () => {
  const schema = `healthz_sleep_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: env.DATABASE_URL });
  const pool = new Pool({ connectionString: env.DATABASE_URL, options: `-c search_path=${schema}` });
  const queries: string[] = [];
  let repository: SleepRecordRepository;
  let legacy: Record<string, unknown>;
  let dateIndex = 0;
  const unused = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const summary = () => ({ sleepDate: `2030-01-${String(++dateIndex).padStart(2, "0")}`, source: "manual", totalSleepMinutes: 444, awakeMinutes: 31, lightMinutes: 250, deepMinutes: 90, remMinutes: 100, sleepScore: 86, notes: "Unchanged" });
  const sessions = (sleepDate: string): SleepRecordInput => ({ sleepDate, source: "watch", detailMode: "sessions", sleepScore: 83, sessions: [
    { sessionType: "main-sleep", sortOrder: 0, totalSleepMinutes: 420, awakeMinutes: 20, awakeCount: 2, lightMinutes: 240, deepMinutes: 80, remMinutes: 100 },
    { sessionType: "nap", label: "Afternoon sleep", sortOrder: 1, totalSleepMinutes: 30 },
  ] });
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(await readFile(new URL("../drizzle/0002_burly_mac_gargan.sql", import.meta.url), "utf8"));
    legacy = (await pool.query(`INSERT INTO sleep_records (sleep_date, total_sleep_minutes, awake_minutes, light_minutes, deep_minutes, rem_minutes, sleep_score, source, notes, created_at, updated_at)
      VALUES ('2026-09-15', 444, 31, 250, 90, 100, 86, 'manual', 'Original', '2026-09-15T08:00:00Z', '2026-09-15T08:00:00Z') RETURNING *`)).rows[0];
    const migration = await readFile(new URL("../drizzle/0007_sleep_sessions.sql", import.meta.url), "utf8");
    expect(migration).not.toMatch(/\b(UPDATE\s+"|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE)\b/i);
    await pool.query(migration.replaceAll('"public".', `"${schema}".`));
    // A database failure after parent writes and child deletion tests real rollback.
    await pool.query("ALTER TABLE sleep_sessions ADD CONSTRAINT test_reject_label CHECK (label <> 'reject')");
    repository = createSleepRecordRepository(drizzle(pool, { logger: { logQuery: (query) => { queries.push(query); } } }));
  });
  afterAll(async () => {
    await pool.end();
    if (!/^healthz_sleep_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema");
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  });
  it("migrates legacy values and timestamps unchanged, without child rows or report changes", async () => {
    const migrated = (await pool.query("SELECT * FROM sleep_records WHERE id = $1", [legacy.id])).rows[0];
    expect(migrated).toEqual({ ...legacy, detail_mode: "summary", awake_count: null });
    expect((await pool.query("SELECT * FROM sleep_sessions")).rows).toEqual([]);
    const response = await repository.findById(legacy.id as string);
    expect(response).toMatchObject({ detailMode: "summary", awakeCount: null, sessions: [], stageCoverage: "complete", totalSleepMinutes: 444 });
    const old = { sleepDate: "2026-09-15", totalSleepMinutes: 444, awakeMinutes: 31, lightMinutes: 250, deepMinutes: 90, remMinutes: 100, sleepScore: 86 };
    const base = { weights: [], bloodPressures: [], papRecords: [], monthlySleep: [], monthlyPap: [] };
    expect(calculateMonthlyReports(["2026-09"], { ...base, sleepRecords: [response!] })).toEqual(calculateMonthlyReports(["2026-09"], { ...base, sleepRecords: [old] }));
  });
  it("creates sessions through the existing HTTP endpoint with calculated aggregates and coverage", async () => {
    const app = createApp(unused, unused, repository, unused);
    const input = sessions(summary().sleepDate);
    const response = await request(app).post("/api/sleep-records").send(input).expect(201);
    expect(response.body).toMatchObject({ detailMode: "sessions", totalSleepMinutes: 450, awakeMinutes: null, awakeCount: null, lightMinutes: null, deepMinutes: null, remMinutes: null, sleepScore: 83, stageCoverage: "partial" });
    expect(response.body.sessions).toHaveLength(2);
    expect(response.body.sessions[1]).toMatchObject({ label: "Afternoon sleep", startedAt: null, endedAt: null });
    const found = await request(app).get(`/api/sleep-records/${response.body.id}`).expect(200);
    expect(found.body).toEqual(response.body);
    await request(app).post("/api/sleep-records").send(input).expect(409);
    await request(app).post("/api/sleep-records").send({ ...input, awakeCount: 99 }).expect(400);
  });
  it("requires explicit modes, converts both ways, and removes children atomically", async () => {
    const input = summary();
    const original = await repository.create(input);
    expect(original.sessions).toEqual([]);
    const converted = await repository.update(original.id, sessions(input.sleepDate));
    expect(converted).toMatchObject({ detailMode: "sessions", totalSleepMinutes: 450 });
    await expect(repository.update(original.id, input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await repository.findById(original.id)).toEqual(converted);
    const app = createApp(unused, unused, repository, unused);
    await request(app).put(`/api/sleep-records/${original.id}`).send({ ...input, detailMode: "summary", totalSleepMinutes: undefined }).expect(400);
    const restored = await repository.update(original.id, { ...input, detailMode: "summary", awakeCount: 0 });
    expect(restored).toMatchObject({ ...input, detailMode: "summary", awakeCount: 0, sessions: [] });
    expect((await pool.query("SELECT * FROM sleep_sessions WHERE sleep_record_id = $1", [original.id])).rows).toEqual([]);
  });
  it("rolls back parent creation on child failure", async () => {
    const input = sessions(summary().sleepDate);
    if (input.detailMode !== "sessions") throw new Error("Expected sessions");
    input.sessions[1]!.label = "reject";
    await expect(repository.create(input)).rejects.toThrow();
    expect((await pool.query("SELECT * FROM sleep_records WHERE sleep_date = $1", [input.sleepDate])).rows).toEqual([]);
  });
  it("rolls back changed aggregates and deleted children on replacement failure", async () => {
    const input = sessions(summary().sleepDate);
    const original = await repository.create(input);
    if (input.detailMode !== "sessions") throw new Error("Expected sessions");
    input.sessions[0]!.totalSleepMinutes = 600;
    input.sessions[1]!.label = "reject";
    await expect(repository.update(original.id, input)).rejects.toThrow();
    expect(await repository.findById(original.id)).toEqual(original);
  });
  it("orders duplicate sort orders by timestamp, nulls last, then ID, and batches list reads", async () => {
    const input = sessions(summary().sleepDate);
    if (input.detailMode !== "sessions") throw new Error("Expected sessions");
    input.sessions = [
      { sessionType: "nap", sortOrder: 1, totalSleepMinutes: 10 },
      { sessionType: "nap", sortOrder: 0, totalSleepMinutes: 20 },
      { sessionType: "other", sortOrder: 0, totalSleepMinutes: 30, startedAt: "2030-01-01T12:00:00Z" },
      { sessionType: "main-sleep", sortOrder: 0, totalSleepMinutes: 40, startedAt: "2030-01-01T10:00:00Z" },
      { sessionType: "nap", sortOrder: 0, totalSleepMinutes: 50, startedAt: "2030-01-01T10:00:00Z" },
    ];
    const result = await repository.create(input);
    expect(result.stageCoverage).toBe("none");
    expect(result.sessions.slice(0, 2).map(({ id }) => id)).toEqual(result.sessions.slice(0, 2).map(({ id }) => id).sort());
    expect(result.sessions.slice(2).map(({ totalSleepMinutes }) => totalSleepMinutes)).toEqual([30, 20, 10]);
    queries.length = 0;
    const list = await repository.list();
    expect(list.find(({ id }) => id === result.id)).toEqual(result);
    expect(queries.filter((query) => query.startsWith("select"))).toHaveLength(2);
  });
  it("cascades parent deletion while deleting a child never deletes its parent", async () => {
    const result = await repository.create(sessions(summary().sleepDate));
    await pool.query("DELETE FROM sleep_sessions WHERE id = $1", [result.sessions[1]!.id]);
    expect((await pool.query("SELECT id FROM sleep_records WHERE id = $1", [result.id])).rows).toHaveLength(1);
    expect(await repository.delete(result.id)).toBe(true);
    expect((await pool.query("SELECT id FROM sleep_sessions WHERE sleep_record_id = $1", [result.id])).rows).toEqual([]);
  });
  it("enforces database checks on session measurements and parent fields", async () => {
    const result = await repository.create(sessions(summary().sleepDate));
    for (const field of ["awake_minutes", "awake_count", "light_minutes", "deep_minutes", "rem_minutes", "sort_order", "total_sleep_minutes"]) {
      await expect(pool.query(`UPDATE sleep_sessions SET ${field} = -1 WHERE id = $1`, [result.sessions[1]!.id])).rejects.toMatchObject({ code: "23514" });
    }
    await expect(pool.query("UPDATE sleep_sessions SET session_type = 'invalid' WHERE id = $1", [result.sessions[0]!.id])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE sleep_sessions SET started_at = now(), ended_at = now() WHERE id = $1", [result.sessions[0]!.id])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE sleep_records SET detail_mode = 'invalid' WHERE id = $1", [result.id])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE sleep_records SET awake_count = -1 WHERE id = $1", [result.id])).rejects.toMatchObject({ code: "23514" });
  });
  it("serializes concurrent replacements so stored aggregates match the final sessions", async () => {
    const input = sessions(summary().sleepDate);
    const result = await repository.create(input);
    const second = createSleepRecordSchema.parse({ ...input, sessions: [{ sessionType: "nap", totalSleepMinutes: 60, sortOrder: 0 }] });
    await Promise.all([repository.update(result.id, input), repository.update(result.id, second)]);
    const final = await repository.findById(result.id);
    expect(final!.totalSleepMinutes).toBe(final!.sessions.reduce((sum, session) => sum + session.totalSleepMinutes, 0));
    expect([60, 450]).toContain(final!.totalSleepMinutes);
  });
});
