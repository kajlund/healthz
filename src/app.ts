import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import type { BodyMeasurementRepository } from "./body-measurements/repository.js";
import { createBodyMeasurementsRouter } from "./body-measurements/router.js";
import { AppError, BodyMeasurementConflictError } from "./errors.js";

export const createApp = (repository: BodyMeasurementRepository) => {
  const app = express();

  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api/body-measurements", createBodyMeasurementsRouter(repository));

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

    if (error instanceof BodyMeasurementConflictError) {
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
