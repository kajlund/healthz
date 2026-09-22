import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import type { BodyMeasurementRepository } from "./body-measurements/repository.js";
import { createBodyMeasurementsRouter } from "./body-measurements/router.js";
import type { BloodPressureReadingRepository } from "./blood-pressure-readings/repository.js";
import { createBloodPressureReadingsRouter } from "./blood-pressure-readings/router.js";
import { AppError, BodyMeasurementConflictError, PapRecordConflictError, SleepRecordConflictError } from "./errors.js";
import type { PapRecordRepository } from "./pap-records/repository.js";
import { createPapRecordsRouter } from "./pap-records/router.js";
import type { SleepRecordRepository } from "./sleep-records/repository.js";
import { createSleepRecordsRouter } from "./sleep-records/router.js";
import type { ReportingService } from "./reports/service.js";
import { createReportsRouter } from "./reports/router.js";
import type { DashboardService } from "./dashboard/service.js";
import { createDashboardRouter } from "./dashboard/router.js";
import type { HealthcareEventRepository } from "./healthcare-events/repository.js";
import { createHealthcareEventsRouter } from "./healthcare-events/router.js";
import type { HealthcareTagRepository } from "./healthcare-tags/repository.js";
import { createHealthcareTagsRouter } from "./healthcare-tags/router.js";
import { createTakeoutRouter } from "./takeout/router.js";
import { TakeoutService } from "./takeout/service.js";

export const createApp = (
  bodyMeasurementRepository: BodyMeasurementRepository,
  bloodPressureReadingRepository: BloodPressureReadingRepository,
  sleepRecordRepository: SleepRecordRepository,
  papRecordRepository: PapRecordRepository,
  reportingService?: ReportingService,
  dashboardService?: DashboardService,
  healthcareEventRepository?: HealthcareEventRepository,
  healthcareTagRepository?: HealthcareTagRepository,
  takeoutService?: TakeoutService,
) => {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/body-measurements", createBodyMeasurementsRouter(bodyMeasurementRepository));
  app.use(
    "/api/blood-pressure-readings",
    createBloodPressureReadingsRouter(bloodPressureReadingRepository),
  );
  app.use("/api/sleep-records", createSleepRecordsRouter(sleepRecordRepository));
  app.use("/api/pap-records", createPapRecordsRouter(papRecordRepository));
  if (reportingService) app.use("/api/reports", createReportsRouter(reportingService));
  if (dashboardService) app.use("/api/dashboard", createDashboardRouter(dashboardService));
  if (healthcareEventRepository) app.use("/api/healthcare-events", createHealthcareEventsRouter(healthcareEventRepository));
  if (healthcareTagRepository) app.use("/api/healthcare-tags", createHealthcareTagsRouter(healthcareTagRepository));
  const effectiveTakeoutService =
    takeoutService ??
    new TakeoutService(
      bodyMeasurementRepository,
      bloodPressureReadingRepository,
      sleepRecordRepository,
      papRecordRepository,
      healthcareEventRepository,
      healthcareTagRepository,
    );
  app.use("/api/takeout", createTakeoutRouter(effectiveTakeoutService));

  app.use(express.static("dist/public"));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: error.issues,
        },
      });
      return;
    }

    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" },
      });
      return;
    }

    if (error instanceof BodyMeasurementConflictError || error instanceof SleepRecordConflictError || error instanceof PapRecordConflictError) {
      response.status(409).json({
        error: { code: "CONFLICT", message: error.message },
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
      return;
    }

    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
    });
  };

  app.use(errorHandler);
  return app;
};
