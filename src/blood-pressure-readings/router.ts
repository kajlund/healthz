import { Router } from "express";

import { AppError } from "../errors.js";
import type { BloodPressureReadingRepository } from "./repository.js";
import {
  bloodPressureReadingIdSchema,
  createBloodPressureReadingSchema,
  updateBloodPressureReadingSchema,
} from "./schemas.js";

export const createBloodPressureReadingsRouter = (repository: BloodPressureReadingRepository) => {
  const router = Router();

  router.post("/", async (request, response) => {
    const input = createBloodPressureReadingSchema.parse(request.body);
    response.status(201).json(await repository.create(input));
  });

  router.get("/", async (_request, response) => {
    response.json(await repository.list());
  });

  router.get("/:id", async (request, response) => {
    const id = bloodPressureReadingIdSchema.parse(request.params.id);
    const reading = await repository.findById(id);
    if (!reading) throw new AppError(404, "NOT_FOUND", "Blood-pressure reading not found");
    response.json(reading);
  });

  router.put("/:id", async (request, response) => {
    const id = bloodPressureReadingIdSchema.parse(request.params.id);
    const input = updateBloodPressureReadingSchema.parse(request.body);
    const reading = await repository.update(id, input);
    if (!reading) throw new AppError(404, "NOT_FOUND", "Blood-pressure reading not found");
    response.json(reading);
  });

  router.delete("/:id", async (request, response) => {
    const id = bloodPressureReadingIdSchema.parse(request.params.id);
    if (!(await repository.delete(id))) {
      throw new AppError(404, "NOT_FOUND", "Blood-pressure reading not found");
    }
    response.status(204).send();
  });

  return router;
};
