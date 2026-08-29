import { createApp } from "./app.js";
import { bodyMeasurementRepository } from "./body-measurements/repository.js";
import { bloodPressureReadingRepository } from "./blood-pressure-readings/repository.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { logger } from "./logger.js";
import { papRecordRepository } from "./pap-records/repository.js";
import { monthlySleepSummaryRepository } from "./monthly-sleep-summaries/repository.js";
import { monthlyPapSummaryRepository } from "./monthly-pap-summaries/repository.js";
import { reportingDataSource } from "./reports/data-source.js";
import { ReportingService } from "./reports/service.js";
import { sleepRecordRepository } from "./sleep-records/repository.js";
import { dashboardLatestSource } from "./dashboard/data-source.js";
import { DashboardService } from "./dashboard/service.js";

const reportingService = new ReportingService(reportingDataSource);
const app = createApp(bodyMeasurementRepository, bloodPressureReadingRepository, sleepRecordRepository, papRecordRepository, monthlySleepSummaryRepository, monthlyPapSummaryRepository, reportingService, new DashboardService(reportingService, dashboardLatestSource));

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "Healthz server started");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
