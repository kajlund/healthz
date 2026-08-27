import { createApp } from "./app.js";
import { bodyMeasurementRepository } from "./body-measurements/repository.js";
import { bloodPressureReadingRepository } from "./blood-pressure-readings/repository.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { logger } from "./logger.js";

const app = createApp(bodyMeasurementRepository, bloodPressureReadingRepository);

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
