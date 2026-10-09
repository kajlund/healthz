import { Router } from "express";

import { AppError } from "../errors.js";
import type { BodyMeasurementRepository } from "./repository.js";
import { dateRangeQuerySchema } from "../common/filters.js";
import {
  bodyMeasurementIdSchema,
  createBodyMeasurementSchema,
  updateBodyMeasurementSchema,
} from "./schemas.js";

export const createBodyMeasurementsRouter = (repository: BodyMeasurementRepository) => {
  const router = Router();

  router.post("/", async (request, response) => {
    const input = createBodyMeasurementSchema.parse(request.body);
    response.status(201).json(await repository.create(input));
  });

  router.get("/", async (request, response) => {
    const query = dateRangeQuerySchema.parse(request.query);
    response.json(await repository.list(query));
  });

  router.get("/:id", async (request, response) => {
    const id = bodyMeasurementIdSchema.parse(request.params.id);
    const measurement = await repository.findById(id);
    if (!measurement) throw new AppError(404, "NOT_FOUND", "Body measurement not found");
    response.json(measurement);
  });

  router.put("/:id", async (request, response) => {
    const id = bodyMeasurementIdSchema.parse(request.params.id);
    const input = updateBodyMeasurementSchema.parse(request.body);
    const measurement = await repository.update(id, input);
    if (!measurement) throw new AppError(404, "NOT_FOUND", "Body measurement not found");
    response.json(measurement);
  });

  router.delete("/:id", async (request, response) => {
    const id = bodyMeasurementIdSchema.parse(request.params.id);
    if (!(await repository.delete(id))) {
      throw new AppError(404, "NOT_FOUND", "Body measurement not found");
    }
    response.status(204).send();
  });

  return router;
};
