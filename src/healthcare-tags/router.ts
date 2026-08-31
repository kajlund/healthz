import { Router } from "express";
import { AppError } from "../errors.js";
import type { HealthcareTagRepository } from "./repository.js";
import { healthcareTagIdSchema, healthcareTagInputSchema } from "./schemas.js";

export const createHealthcareTagsRouter = (repository: HealthcareTagRepository) => {
  const router = Router();
  router.get("/", async (_request, response) => response.json(await repository.list()));
  router.post("/", async (request, response) => response.status(201).json(await repository.create(healthcareTagInputSchema.parse(request.body))));
  router.put("/:id", async (request, response) => { const tag = await repository.update(healthcareTagIdSchema.parse(request.params.id), healthcareTagInputSchema.parse(request.body)); if (!tag) throw new AppError(404, "NOT_FOUND", "Healthcare tag not found"); response.json(tag); });
  router.delete("/:id", async (request, response) => { if (!(await repository.delete(healthcareTagIdSchema.parse(request.params.id)))) throw new AppError(404, "NOT_FOUND", "Healthcare tag not found"); response.status(204).send(); });
  return router;
};
