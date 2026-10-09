import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { HealthcareEvent, HealthcareEventRepository } from "../src/healthcare-events/repository.js";
import { healthcareEventInputSchema, healthcareEventListQuerySchema } from "../src/healthcare-events/schemas.js";
import { AppError } from "../src/errors.js";
import type { BodyMeasurementRepository } from "../src/body-measurements/repository.js";
import type { BloodPressureReadingRepository } from "../src/blood-pressure-readings/repository.js";
import type { SleepRecordRepository } from "../src/sleep-records/repository.js";
import type { PapRecordRepository } from "../src/pap-records/repository.js";

const eventId = "3bd395b9-6d1d-4e4f-ae88-b06de082f29c";
const doctorId = "cd193842-b59e-44cc-90d8-f995f189a90c";
const vaccineId = "352a31e4-01b0-455f-8e4c-86f44171554c";
const row = (overrides: Partial<HealthcareEvent> = {}): HealthcareEvent => ({ id: eventId, eventDate: "2025-10-14", eventTime: null, title: "Doctor visit", description: null, provider: null, organization: null, location: null, tags: [], createdAt: new Date("2025-10-14T10:00:00Z"), updatedAt: new Date("2025-10-14T10:00:00Z"), ...overrides });
const input = { eventDate: "2025-10-14", eventTime: null, title: "Doctor visit", description: null, provider: null, organization: null, location: null, tagIds: [] as string[] };
const repository = (): HealthcareEventRepository => ({ create: vi.fn().mockResolvedValue(row()), list: vi.fn().mockResolvedValue({ items: [row()], total: 1, latestEventDate: "2025-10-14", page: 1, pageSize: 25 }), findById: vi.fn().mockResolvedValue(row()), update: vi.fn().mockResolvedValue(row()), delete: vi.fn().mockResolvedValue(true), dashboard: vi.fn().mockResolvedValue({ latestPast: null, nextFuture: null }) });
const empty = { create: vi.fn(), list: vi.fn(), findById: vi.fn(), update: vi.fn(), delete: vi.fn() } as unknown as BodyMeasurementRepository;
const app = (events: HealthcareEventRepository) => createApp(empty, empty as unknown as BloodPressureReadingRepository, empty as unknown as SleepRecordRepository, empty as unknown as PapRecordRepository, undefined, undefined, events);

describe("healthcare event validation", () => {
  it("accepts a date-only event without tags and a future date", () => { expect(healthcareEventInputSchema.parse({ ...input, eventDate: "2099-01-01" })).toMatchObject({ eventTime: null, tagIds: [] }); });
  it("accepts HH:mm without converting the calendar date", () => { expect(healthcareEventInputSchema.parse({ ...input, eventTime: "09:30" })).toMatchObject({ eventDate: "2025-10-14", eventTime: "09:30" }); });
  it("deduplicates tag IDs", () => { expect(healthcareEventInputSchema.parse({ ...input, tagIds: [doctorId, doctorId, vaccineId] }).tagIds).toEqual([doctorId, vaccineId]); });
  it.each(["2025-02-30", "2025-2-01"])("rejects invalid date %s", (eventDate) => expect(healthcareEventInputSchema.safeParse({ ...input, eventDate }).success).toBe(false));
  it.each(["24:00", "9:30", "12:60"])("rejects invalid time %s", (eventTime) => expect(healthcareEventInputSchema.safeParse({ ...input, eventTime }).success).toBe(false));
  it("normalizes empty optional strings to null", () => { expect(healthcareEventInputSchema.parse({ ...input, description: "  ", provider: " " })).toMatchObject({ description: null, provider: null }); });
});

describe("healthcare event routes", () => {
  let events: HealthcareEventRepository;
  beforeEach(() => { events = repository(); });
  it("creates events with no, one, or several tags", async () => { for (const tagIds of [[], [doctorId], [doctorId, vaccineId]]) { const response = await request(app(events)).post("/api/healthcare-events").send({ ...input, tagIds }); expect(response.status).toBe(201); } expect(events.create).toHaveBeenNthCalledWith(3, { ...input, tagIds: [doctorId, vaccineId] }); });
  it("returns missing-tag validation failures without a partial success", async () => { vi.mocked(events.create).mockRejectedValueOnce(new AppError(400, "VALIDATION_ERROR", "One or more healthcare tags do not exist", { missingTagIds: [doctorId] })); const response = await request(app(events)).post("/api/healthcare-events").send({ ...input, tagIds: [doctorId] }); expect(response.status).toBe(400); expect(response.body.error.details.missingTagIds).toEqual([doctorId]); });
  it("updates details and replacement tag assignments", async () => { await request(app(events)).put(`/api/healthcare-events/${eventId}`).send({ ...input, title: "Doctor and vaccination", tagIds: [doctorId, vaccineId] }).expect(200); expect(events.update).toHaveBeenCalledWith(eventId, { ...input, title: "Doctor and vaccination", tagIds: [doctorId, vaccineId] }); });
  it("deletes an event through the repository", async () => { await request(app(events)).delete(`/api/healthcare-events/${eventId}`).expect(204); expect(events.delete).toHaveBeenCalledWith(eventId); });
  it("returns a paginated total and passes combined filters", async () => { const response = await request(app(events)).get(`/api/healthcare-events?from=2025-01-01&to=2025-12-31&search=clinic&tagIds=${doctorId},${vaccineId}&tagMatch=all&page=2&pageSize=10`); expect(response.status).toBe(200); expect(response.body.total).toBe(1); expect(events.list).toHaveBeenCalledWith({ from: "2025-01-01", to: "2025-12-31", search: "clinic", tagIds: [doctorId, vaccineId], tagMatch: "all", page: 2, pageSize: 10 }); });
  it("rejects a reversed date range", () => expect(healthcareEventListQuerySchema.safeParse({ from: "2025-12-31", to: "2025-01-01" }).success).toBe(false));
  it("defaults tag matching and bounded pagination", () => expect(healthcareEventListQuerySchema.parse({})).toMatchObject({ tagMatch: "any", page: 1, pageSize: 25 }));
});
