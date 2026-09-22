import { Router } from "express";

import { AppError } from "../errors.js";
import type { PapRecordRepository } from "./repository.js";
import { dateRangeQuerySchema } from "../common/filters.js";
import { createPapRecordSchema, papRecordIdSchema, updatePapRecordSchema } from "./schemas.js";

export const createPapRecordsRouter = (repository: PapRecordRepository) => {
  const router = Router();
  router.post("/", async (request, response) => {
    response.status(201).json(await repository.create(createPapRecordSchema.parse(request.body)));
  });
  router.get("/", async (request, response) => {
    const query = dateRangeQuerySchema.parse(request.query);
    response.json(await repository.list(query));
  });
  router.get("/:id", async (request, response) => {
    const record = await repository.findById(papRecordIdSchema.parse(request.params.id));
    if (!record) throw new AppError(404, "NOT_FOUND", "PAP record not found");
    response.json(record);
  });
  router.put("/:id", async (request, response) => {
    const id = papRecordIdSchema.parse(request.params.id);
    const record = await repository.update(id, updatePapRecordSchema.parse(request.body));
    if (!record) throw new AppError(404, "NOT_FOUND", "PAP record not found");
    response.json(record);
  });
  router.delete("/:id", async (request, response) => {
    const id = papRecordIdSchema.parse(request.params.id);
    if (!(await repository.delete(id))) throw new AppError(404, "NOT_FOUND", "PAP record not found");
    response.status(204).send();
  });
  return router;
};
