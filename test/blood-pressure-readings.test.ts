import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { BodyMeasurementRepository } from "../src/body-measurements/repository.js";
import type {
  BloodPressureReading,
  BloodPressureReadingRepository,
} from "../src/blood-pressure-readings/repository.js";
import type { SleepRecordRepository } from "../src/sleep-records/repository.js";
import type { PapRecordRepository } from "../src/pap-records/repository.js";

const firstId = "82a123e3-ded4-4d5d-954b-92ff3de390e1";
const secondId = "4682623b-1791-45f4-8938-3e55238c0951";

const reading = (overrides: Partial<BloodPressureReading> = {}): BloodPressureReading => ({
  id: firstId,
  measuredAt: new Date("2026-08-27T18:30:00.000Z"),
  systolic: 122,
  diastolic: 78,
  pulse: 64,
  notes: null,
  createdAt: new Date("2026-08-27T18:31:00.000Z"),
  updatedAt: new Date("2026-08-27T18:31:00.000Z"),
  ...overrides,
});

const bodyMeasurementRepository: BodyMeasurementRepository = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const sleepRepository: SleepRecordRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };
const papRepository: PapRecordRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };

const createRepository = (): BloodPressureReadingRepository => ({
  create: vi.fn().mockResolvedValue(reading()),
  list: vi.fn().mockResolvedValue([
    reading(),
    reading({ id: secondId, measuredAt: new Date("2026-08-27T07:15:00.000Z") }),
  ]),
  findById: vi.fn().mockResolvedValue(reading()),
  update: vi.fn().mockResolvedValue(reading({ systolic: 118, diastolic: 75 })),
  delete: vi.fn().mockResolvedValue(true),
});

const validInput = {
  measuredAt: "2026-08-27T18:30:00.000Z",
  systolic: 122,
  diastolic: 78,
  pulse: 64,
  notes: "  After dinner  ",
};

describe("blood-pressure reading routes", () => {
  let repository: BloodPressureReadingRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  const app = () => createApp(bodyMeasurementRepository, repository, sleepRepository, papRepository);

  it("creates a valid reading and normalizes its notes", async () => {
    const response = await request(app()).post("/api/blood-pressure-readings").send(validInput);

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(firstId);
    expect(repository.create).toHaveBeenCalledWith({ ...validInput, notes: "After dinner" });
  });

  it("allows multiple readings on the same day", async () => {
    await request(app()).post("/api/blood-pressure-readings").send(validInput);
    await request(app()).post("/api/blood-pressure-readings").send({
      ...validInput,
      measuredAt: "2026-08-27T07:15:00.000Z",
    });

    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it("rejects missing required values", async () => {
    const response = await request(app()).post("/api/blood-pressure-readings").send({ pulse: 60 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(["not-a-date", "2026-08-27T18:30:00"])("rejects invalid timestamp %s", async (measuredAt) => {
    const response = await request(app()).post("/api/blood-pressure-readings").send({
      ...validInput,
      measuredAt,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    { systolic: 0 },
    { diastolic: -1 },
    { pulse: 0 },
  ])("rejects non-positive numeric values: %o", async (invalidValues) => {
    const response = await request(app()).post("/api/blood-pressure-readings").send({
      ...validInput,
      ...invalidValues,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires systolic pressure to be greater than diastolic pressure", async () => {
    const response = await request(app()).post("/api/blood-pressure-readings").send({
      ...validInput,
      systolic: 80,
      diastolic: 80,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].message).toBe(
      "Systolic pressure must be greater than diastolic pressure",
    );
  });

  it("lists readings in the newest-first order supplied by the repository query", async () => {
    const response = await request(app()).get("/api/blood-pressure-readings");

    expect(response.status).toBe(200);
    expect(response.body.map((item: BloodPressureReading) => item.measuredAt)).toEqual([
      "2026-08-27T18:30:00.000Z",
      "2026-08-27T07:15:00.000Z",
    ]);
  });

  it("updates a reading", async () => {
    const response = await request(app()).put(`/api/blood-pressure-readings/${firstId}`).send({
      ...validInput,
      systolic: 118,
      diastolic: 75,
      pulse: null,
      notes: "   ",
    });

    expect(response.status).toBe(200);
    expect(response.body.systolic).toBe(118);
    expect(repository.update).toHaveBeenCalledWith(firstId, {
      ...validInput,
      systolic: 118,
      diastolic: 75,
      pulse: null,
      notes: null,
    });
  });

  it("deletes a reading", async () => {
    const response = await request(app()).delete(`/api/blood-pressure-readings/${firstId}`);

    expect(response.status).toBe(204);
    expect(repository.delete).toHaveBeenCalledWith(firstId);
  });

  it("returns the existing not-found error for a missing reading", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(undefined);

    const response = await request(app()).get(`/api/blood-pressure-readings/${firstId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Blood-pressure reading not found" },
    });
  });

  it("rejects a malformed reading id", async () => {
    const response = await request(app()).get("/api/blood-pressure-readings/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
