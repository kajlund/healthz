import { Router } from "express";
import type { TakeoutService } from "./service.js";
import type { TakeoutDataset } from "./types.js";

const todayDateString = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export const createTakeoutRouter = (service: TakeoutService) => {
  const router = Router();

  router.get("/", async (request, response) => {
    const dataset = (request.query.dataset as TakeoutDataset | undefined) ?? "all";
    const download = request.query.download === "true" || request.query.download === "1";
    const today = todayDateString();

    const fullTakeout = await service.exportAll();

    let payload: unknown;
    let filename: string;

    switch (dataset) {
      case "body-measurements":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "body-measurements",
          count: fullTakeout.counts.bodyMeasurements,
          items: fullTakeout.bodyMeasurements,
        };
        filename = `healthz-body-measurements-${today}.json`;
        break;

      case "blood-pressure":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "blood-pressure",
          count: fullTakeout.counts.bloodPressureReadings,
          items: fullTakeout.bloodPressureReadings,
        };
        filename = `healthz-blood-pressure-${today}.json`;
        break;

      case "sleep":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "sleep",
          count: fullTakeout.counts.sleepRecords,
          sessionCount: fullTakeout.counts.sleepSessions,
          items: fullTakeout.sleepRecords,
        };
        filename = `healthz-sleep-${today}.json`;
        break;

      case "pap":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "pap",
          count: fullTakeout.counts.papRecords,
          items: fullTakeout.papRecords,
        };
        filename = `healthz-pap-${today}.json`;
        break;

      case "journal-events":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "journal-events",
          count: fullTakeout.counts.healthcareEvents,
          items: fullTakeout.healthcareEvents,
        };
        filename = `healthz-journal-events-${today}.json`;
        break;

      case "journal-tags":
        payload = {
          version: 1,
          exportedAt: fullTakeout.exportedAt,
          dataset: "journal-tags",
          count: fullTakeout.counts.healthcareTags,
          items: fullTakeout.healthcareTags,
        };
        filename = `healthz-journal-tags-${today}.json`;
        break;

      case "all":
      default:
        payload = fullTakeout;
        filename = `healthz-takeout-${today}.json`;
        break;
    }

    if (download) {
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.send(JSON.stringify(payload, null, 2));
  });

  return router;
};
