import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { BodyMeasurementRepository } from "../src/body-measurements/repository.js";
import type { BloodPressureReadingRepository } from "../src/blood-pressure-readings/repository.js";
import { PapRecordConflictError } from "../src/errors.js";
import type { PapRecord, PapRecordRepository } from "../src/pap-records/repository.js";
import { valuesFromPapInput } from "../src/pap-records/repository.js";
import type { SleepRecordRepository } from "../src/sleep-records/repository.js";

const firstId = "649526cf-a3dc-49fc-a158-506c26875ed7";
const secondId = "780f3408-229d-494d-9db4-bdeec0d44b36";
const papRecord = (overrides: Partial<PapRecord> = {}): PapRecord => ({
  id: firstId, therapyDate: "2026-08-28", healthDate: "2026-08-29", usageMinutes: 438, eventsPerHour: 2.35,
  maskSealScore: 18, maskOnOffCount: 2, totalScore: 91, source: "manual", notes: null,
  createdAt: new Date("2026-08-28T08:00:00Z"), updatedAt: new Date("2026-08-28T08:00:00Z"), ...overrides,
});
const bodyRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as BodyMeasurementRepository;
const pressureRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as BloodPressureReadingRepository;
const sleepRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as SleepRecordRepository;
const valid = { therapyDate: "2026-08-28", healthDate: "2026-08-29", usageMinutes: 438, eventsPerHour: 2.35, maskSealScore: 18, maskOnOffCount: 2, totalScore: 91, source: "  manual  ", notes: "  Good seal  " };

describe("PAP record routes", () => {
  let repository: PapRecordRepository;
  beforeEach(() => { repository = { create: vi.fn().mockResolvedValue(papRecord()), list: vi.fn().mockResolvedValue([papRecord(), papRecord({ id: secondId, therapyDate: "2026-08-27" })]), findById: vi.fn().mockResolvedValue(papRecord()), update: vi.fn().mockResolvedValue(papRecord({ usageMinutes: null })), delete: vi.fn().mockResolvedValue(true) }; });
  const app = () => createApp(bodyRepository, pressureRepository, sleepRepository, repository);

  it("creates a record with all measurements", async () => { const response = await request(app()).post("/api/pap-records").send(valid); expect(response.status).toBe(201); expect(repository.create).toHaveBeenCalledWith({ ...valid, source: "manual", notes: "Good seal" }); });
  it("creates a record with only one measurement", async () => { const input = { therapyDate: "2026-08-28", healthDate: "2026-08-29", eventsPerHour: 1.2, source: "manual" }; expect((await request(app()).post("/api/pap-records").send(input)).status).toBe(201); expect(repository.create).toHaveBeenCalledWith(input); });
  it("requires a Health date for creation", async () => { const { healthDate: _, ...input } = valid; expect((await request(app()).post("/api/pap-records").send(input)).status).toBe(400); });
  it("rejects an invalid Health date", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, healthDate: "2026-02-30" })).status).toBe(400); });
  it("rejects a record without measurements", async () => { const response = await request(app()).post("/api/pap-records").send({ therapyDate: "2026-08-28", healthDate: "2026-08-29", source: "manual" }); expect(response.status).toBe(400); expect(response.body.error.details[0].message).toBe("At least one PAP measurement is required"); });
  it("returns conflict for a duplicate date", async () => { vi.mocked(repository.create).mockRejectedValueOnce(new PapRecordConflictError()); expect((await request(app()).post("/api/pap-records").send(valid)).status).toBe(409); });
  it.each(["2026-02-30", "28-08-2026"])("rejects invalid therapy date %s", async (therapyDate) => { expect((await request(app()).post("/api/pap-records").send({ ...valid, therapyDate })).status).toBe(400); });
  it("rejects negative usage", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, usageMinutes: -1 })).status).toBe(400); });
  it("rejects usage over 24 hours", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, usageMinutes: 1441 })).status).toBe(400); });
  it("rejects negative events per hour", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, eventsPerHour: -0.01 })).status).toBe(400); });
  it("rejects excessive event-rate precision", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, eventsPerHour: 1.234 })).status).toBe(400); });
  it("rejects a negative mask seal score", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, maskSealScore: -1 })).status).toBe(400); });
  it("rejects a negative mask on/off count", async () => { expect((await request(app()).post("/api/pap-records").send({ ...valid, maskOnOffCount: -1 })).status).toBe(400); });
  it.each([-1, 101])("rejects total score %s", async (totalScore) => { expect((await request(app()).post("/api/pap-records").send({ ...valid, totalScore })).status).toBe(400); });
  it("keeps missing values null instead of zero", () => { expect(valuesFromPapInput({ therapyDate: "2026-08-28", healthDate: "2026-08-29", eventsPerHour: 0, source: "manual" })).toMatchObject({ usageMinutes: null, eventsPerHour: 0, maskSealScore: null, maskOnOffCount: null, totalScore: null }); });
  it("returns decimal database values as JSON numbers", async () => { const response = await request(app()).get(`/api/pap-records/${firstId}`); expect(response.body.eventsPerHour).toBe(2.35); expect(typeof response.body.eventsPerHour).toBe("number"); });
  it("fetches a legacy record with a null Health date", async () => { vi.mocked(repository.findById).mockResolvedValueOnce(papRecord({ healthDate: null })); const response = await request(app()).get(`/api/pap-records/${firstId}`); expect(response.status).toBe(200); expect(response.body.healthDate).toBeNull(); });
  it("lists newest therapy date first", async () => { const response = await request(app()).get("/api/pap-records"); expect(response.body.map((item: PapRecord) => item.therapyDate)).toEqual(["2026-08-28", "2026-08-27"]); });
  it("filters PAP records by from and to dates", async () => { const response = await request(app()).get("/api/pap-records?from=2026-08-01&to=2026-08-31"); expect(response.status).toBe(200); expect(repository.list).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-31" }); });
  it("rejects invalid date range filter where from is after to", async () => { const response = await request(app()).get("/api/pap-records?from=2026-08-31&to=2026-08-01"); expect(response.status).toBe(400); expect(response.body.error.code).toBe("VALIDATION_ERROR"); });
  it("updates a record", async () => { const response = await request(app()).put(`/api/pap-records/${firstId}`).send(valid); expect(response.status).toBe(200); expect(repository.update).toHaveBeenCalledWith(firstId, { ...valid, source: "manual", notes: "Good seal" }); });
  it("requires Health date when updating a legacy record", async () => { const { healthDate: _, ...input } = valid; expect((await request(app()).put(`/api/pap-records/${firstId}`).send(input)).status).toBe(400); });
  it("returns conflict when update uses an existing date", async () => { vi.mocked(repository.update).mockRejectedValueOnce(new PapRecordConflictError()); expect((await request(app()).put(`/api/pap-records/${firstId}`).send(valid)).status).toBe(409); });
  it("clears an optional value during update", async () => { const input = { ...valid, usageMinutes: null }; const response = await request(app()).put(`/api/pap-records/${firstId}`).send(input); expect(response.status).toBe(200); expect(repository.update).toHaveBeenCalledWith(firstId, { ...input, source: "manual", notes: "Good seal" }); });
  it("deletes a record", async () => { expect((await request(app()).delete(`/api/pap-records/${firstId}`)).status).toBe(204); expect(repository.delete).toHaveBeenCalledWith(firstId); });
  it("deletes a legacy record without a Health date", async () => { vi.mocked(repository.findById).mockResolvedValueOnce(papRecord({ healthDate: null })); expect((await request(app()).delete(`/api/pap-records/${firstId}`)).status).toBe(204); });
  it("returns not found for a missing record", async () => { vi.mocked(repository.findById).mockResolvedValueOnce(undefined); const response = await request(app()).get(`/api/pap-records/${firstId}`); expect(response.status).toBe(404); expect(response.body.error.message).toBe("PAP record not found"); });
  it("rejects a malformed id", async () => { expect((await request(app()).get("/api/pap-records/nope")).status).toBe(400); });
});
