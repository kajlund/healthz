import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type {
  BodyMeasurement,
  BodyMeasurementRepository,
} from "../src/body-measurements/repository.js";
import { BodyMeasurementConflictError } from "../src/errors.js";

const firstId = "3bd395b9-6d1d-4e4f-ae88-b06de082f29c";
const secondId = "cd193842-b59e-44cc-90d8-f995f189a90c";

const measurement = (overrides: Partial<BodyMeasurement> = {}): BodyMeasurement => ({
  id: firstId,
  measuredOn: "2026-08-27",
  weightKg: 82.45,
  notes: null,
  createdAt: new Date("2026-08-27T08:00:00.000Z"),
  updatedAt: new Date("2026-08-27T08:00:00.000Z"),
  ...overrides,
});

const createRepository = (): BodyMeasurementRepository => ({
  create: vi.fn().mockResolvedValue(measurement()),
  list: vi.fn().mockResolvedValue([
    measurement(),
    measurement({ id: secondId, measuredOn: "2026-08-26" }),
  ]),
  findById: vi.fn().mockResolvedValue(measurement()),
  update: vi.fn().mockResolvedValue(measurement({ weightKg: 81.9 })),
  delete: vi.fn().mockResolvedValue(true),
});

describe("body measurement routes", () => {
  let repository: BodyMeasurementRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("creates a body measurement", async () => {
    const response = await request(createApp(repository)).post("/api/body-measurements").send({
      measuredOn: "2026-08-27",
      weightKg: 82.45,
      notes: "Morning",
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(firstId);
    expect(repository.create).toHaveBeenCalledWith({
      measuredOn: "2026-08-27",
      weightKg: 82.45,
      notes: "Morning",
    });
  });

  it("rejects invalid input without calling the repository", async () => {
    const response = await request(createApp(repository)).post("/api/body-measurements").send({
      measuredOn: "2026-02-30",
      weightKg: -1,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toHaveLength(2);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("lists measurements in the order supplied by the newest-first repository query", async () => {
    const response = await request(createApp(repository)).get("/api/body-measurements");

    expect(response.status).toBe(200);
    expect(response.body.map((item: BodyMeasurement) => item.measuredOn)).toEqual([
      "2026-08-27",
      "2026-08-26",
    ]);
  });

  it("gets a body measurement by id", async () => {
    const response = await request(createApp(repository)).get(`/api/body-measurements/${firstId}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(firstId);
    expect(repository.findById).toHaveBeenCalledWith(firstId);
  });

  it("updates a body measurement", async () => {
    const response = await request(createApp(repository)).put(`/api/body-measurements/${firstId}`).send({
      measuredOn: "2026-08-27",
      weightKg: 81.9,
      notes: null,
    });

    expect(response.status).toBe(200);
    expect(response.body.weightKg).toBe(81.9);
    expect(repository.update).toHaveBeenCalledWith(firstId, {
      measuredOn: "2026-08-27",
      weightKg: 81.9,
      notes: null,
    });
  });

  it("deletes a body measurement", async () => {
    const response = await request(createApp(repository)).delete(`/api/body-measurements/${firstId}`);

    expect(response.status).toBe(204);
    expect(repository.delete).toHaveBeenCalledWith(firstId);
  });

  it("returns a consistent error for a missing measurement", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(undefined);

    const response = await request(createApp(repository)).get(`/api/body-measurements/${firstId}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Body measurement not found" },
    });
  });

  it("returns a consistent error for a date conflict", async () => {
    vi.mocked(repository.create).mockRejectedValueOnce(new BodyMeasurementConflictError());

    const response = await request(createApp(repository)).post("/api/body-measurements").send({
      measuredOn: "2026-08-27",
      weightKg: 82.45,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "A body-weight measurement already exists for this date",
      },
    });
  });

  it("rejects an invalid measurement id", async () => {
    const response = await request(createApp(repository)).get("/api/body-measurements/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
