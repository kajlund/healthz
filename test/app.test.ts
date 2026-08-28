import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { BodyMeasurementRepository } from "../src/body-measurements/repository.js";
import type { BloodPressureReadingRepository } from "../src/blood-pressure-readings/repository.js";
import type { SleepRecordRepository } from "../src/sleep-records/repository.js";

const repository: BodyMeasurementRepository = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const bloodPressureRepository: BloodPressureReadingRepository = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
const sleepRepository: SleepRecordRepository = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() };

const app = createApp(repository, bloodPressureRepository, sleepRepository);

describe("HTTP application", () => {
  it("reports that it is healthy", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns JSON for an unknown route", async () => {
    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
    expect(response.headers["content-type"]).toMatch(/json/);
  });
});
