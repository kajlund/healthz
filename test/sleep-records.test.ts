import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { BodyMeasurementRepository } from "../src/body-measurements/repository.js";
import type { BloodPressureReadingRepository } from "../src/blood-pressure-readings/repository.js";
import { SleepRecordConflictError } from "../src/errors.js";
import type { SleepRecord, SleepRecordRepository } from "../src/sleep-records/repository.js";
import type { PapRecordRepository } from "../src/pap-records/repository.js";

const firstId = "70cd081d-2196-4cf4-b96e-de788420fe28";
const secondId = "fef5aa30-bb27-4525-9f66-e12dd16432e0";
const record = (overrides: Partial<SleepRecord> = {}): SleepRecord => ({ id: firstId, detailMode: "summary", awakeCount: null, sessions: [], stageCoverage: "complete", sleepDate: "2026-08-28", totalSleepMinutes: 444, awakeMinutes: 31, lightMinutes: 250, deepMinutes: 90, remMinutes: 100, sleepScore: 86, source: "manual", notes: "Rested", createdAt: new Date("2026-08-28T08:00:00Z"), updatedAt: new Date("2026-08-28T08:00:00Z"), ...overrides });
const unused = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
const bodyRepository = unused as BodyMeasurementRepository;
const pressureRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as BloodPressureReadingRepository;
const papRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as PapRecordRepository;
const valid = { sleepDate: "2026-08-28", totalSleepMinutes: 444, awakeMinutes: 31, lightMinutes: 250, deepMinutes: 90, remMinutes: 100, sleepScore: 86, source: "  watch  ", notes: "  Rested  " };

describe("sleep record routes", () => {
  let repository: SleepRecordRepository;
  beforeEach(() => { repository = { create: vi.fn().mockResolvedValue(record()), list: vi.fn().mockResolvedValue([record(), record({ id: secondId, sleepDate: "2026-08-27" })]), findById: vi.fn().mockResolvedValue(record()), update: vi.fn().mockResolvedValue(record({ totalSleepMinutes: 460 })), delete: vi.fn().mockResolvedValue(true) }; });
  const app = () => createApp(bodyRepository, pressureRepository, repository, papRepository);
  it("creates a record with all fields and normalizes text", async () => { const response = await request(app()).post("/api/sleep-records").send(valid); expect(response.status).toBe(201); expect(repository.create).toHaveBeenCalledWith({ ...valid, source: "watch", notes: "Rested" }); });
  it("creates a record with required fields", async () => { const input = { sleepDate: "2026-08-28", totalSleepMinutes: 444, source: "manual" }; expect((await request(app()).post("/api/sleep-records").send(input)).status).toBe(201); expect(repository.create).toHaveBeenCalledWith(input); });
  it("returns conflict for a duplicate sleep date", async () => { vi.mocked(repository.create).mockRejectedValueOnce(new SleepRecordConflictError()); const response = await request(app()).post("/api/sleep-records").send(valid); expect(response.status).toBe(409); expect(response.body.error.code).toBe("CONFLICT"); });
  it.each(["2026-02-30", "28-08-2026"])("rejects invalid date %s", async (sleepDate) => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, sleepDate })).status).toBe(400); });
  it.each([0, -1])("rejects total sleep %s", async (totalSleepMinutes) => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, totalSleepMinutes })).status).toBe(400); });
  it("rejects a negative optional duration", async () => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, deepMinutes: -1 })).status).toBe(400); });
  it.each([1450, 2000])("rejects duration over 24 hours", async (totalSleepMinutes) => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, totalSleepMinutes })).status).toBe(400); });
  it("rejects an optional duration over 24 hours", async () => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, awakeMinutes: 1441 })).status).toBe(400); });
  it.each([-1, 101])("rejects sleep score %s", async (sleepScore) => { expect((await request(app()).post("/api/sleep-records").send({ ...valid, sleepScore })).status).toBe(400); });
  it("accepts stage totals differing from total sleep", async () => { const response = await request(app()).post("/api/sleep-records").send({ ...valid, lightMinutes: 1, deepMinutes: 2, remMinutes: 3 }); expect(response.status).toBe(201); expect(repository.create).toHaveBeenCalled(); });
  it("lists newest sleep date first", async () => { const response = await request(app()).get("/api/sleep-records"); expect(response.body.map((item: SleepRecord) => item.sleepDate)).toEqual(["2026-08-28", "2026-08-27"]); });
  it("updates a record", async () => { const response = await request(app()).put(`/api/sleep-records/${firstId}`).send({ ...valid, totalSleepMinutes: 460 }); expect(response.status).toBe(200); expect(repository.update).toHaveBeenCalledWith(firstId, { ...valid, totalSleepMinutes: 460, source: "watch", notes: "Rested" }); });
  it("returns conflict when update uses an existing date", async () => { vi.mocked(repository.update).mockRejectedValueOnce(new SleepRecordConflictError()); expect((await request(app()).put(`/api/sleep-records/${firstId}`).send(valid)).status).toBe(409); });
  it("deletes a record", async () => { expect((await request(app()).delete(`/api/sleep-records/${firstId}`)).status).toBe(204); expect(repository.delete).toHaveBeenCalledWith(firstId); });
  it("returns not found for a missing record", async () => { vi.mocked(repository.findById).mockResolvedValueOnce(undefined); const response = await request(app()).get(`/api/sleep-records/${firstId}`); expect(response.status).toBe(404); expect(response.body.error.message).toBe("Sleep record not found"); });
  it("rejects a malformed id", async () => { expect((await request(app()).get("/api/sleep-records/nope")).status).toBe(400); });
});
