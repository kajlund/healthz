import { Router } from 'express';
import { AppError } from '../errors.js';
import type { HealthcareEventRepository } from './repository.js';
import {
  healthcareEventIdSchema,
  healthcareEventInputSchema,
  healthcareEventListQuerySchema,
} from './schemas.js';

export const createHealthcareEventsRouter = (
  repository: HealthcareEventRepository,
) => {
  const router = Router();
  router.post('/', async (request, response) =>
    response
      .status(201)
      .json(
        await repository.create(healthcareEventInputSchema.parse(request.body)),
      ),
  );
  router.get('/', async (request, response) =>
    response.json(
      await repository.list(
        healthcareEventListQuerySchema.parse(request.query),
      ),
    ),
  );
  router.get('/:id', async (request, response) => {
    const event = await repository.findById(
      healthcareEventIdSchema.parse(request.params.id),
    );
    if (!event)
      throw new AppError(404, 'NOT_FOUND', 'Healthcare event not found');
    response.json(event);
  });
  router.put('/:id', async (request, response) => {
    const event = await repository.update(
      healthcareEventIdSchema.parse(request.params.id),
      healthcareEventInputSchema.parse(request.body),
    );
    if (!event)
      throw new AppError(404, 'NOT_FOUND', 'Healthcare event not found');
    response.json(event);
  });
  router.delete('/:id', async (request, response) => {
    if (
      !(await repository.delete(
        healthcareEventIdSchema.parse(request.params.id),
      ))
    )
      throw new AppError(404, 'NOT_FOUND', 'Healthcare event not found');
    response.status(204).send();
  });
  return router;
};
