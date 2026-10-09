import { Router } from 'express';
import { AppError } from '../errors.js';
import type { SleepRecordRepository } from './repository.js';
import { dateRangeQuerySchema } from '../common/filters.js';
import {
  createSleepRecordSchema,
  sleepRecordIdSchema,
  updateSleepRecordSchema,
} from './schemas.js';

export const createSleepRecordsRouter = (repository: SleepRecordRepository) => {
  const router = Router();
  router.post('/', async (request, response) => {
    response
      .status(201)
      .json(
        await repository.create(createSleepRecordSchema.parse(request.body)),
      );
  });
  router.get('/', async (request, response) => {
    const query = dateRangeQuerySchema.parse(request.query);
    response.json(await repository.list(query));
  });
  router.get('/:id', async (request, response) => {
    const record = await repository.findById(
      sleepRecordIdSchema.parse(request.params.id),
    );
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Sleep record not found');
    response.json(record);
  });
  router.put('/:id', async (request, response) => {
    const id = sleepRecordIdSchema.parse(request.params.id);
    const record = await repository.update(
      id,
      updateSleepRecordSchema.parse(request.body),
    );
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Sleep record not found');
    response.json(record);
  });
  router.delete('/:id', async (request, response) => {
    const id = sleepRecordIdSchema.parse(request.params.id);
    if (!(await repository.delete(id)))
      throw new AppError(404, 'NOT_FOUND', 'Sleep record not found');
    response.status(204).send();
  });
  return router;
};
