import { Router } from 'express';
import { AppError } from '../errors.js';
import type { MonthlySleepRepository } from './repository.js';
import {
  createMonthlySleepSchema,
  monthlySleepParamsSchema,
  monthlySleepQuerySchema,
  monthlySleepValuesSchema,
} from './schemas.js';

export const createMonthlySleepRouter = (
  repository: MonthlySleepRepository,
) => {
  const router = Router();
  const missing = () =>
    new AppError(404, 'NOT_FOUND', 'Monthly sleep average not found');
  router.get('/', async (req, res) => {
    res.json(
      await repository.list(monthlySleepQuerySchema.parse(req.query).year),
    );
  });
  router.post('/', async (req, res) => {
    res
      .status(201)
      .json(await repository.create(createMonthlySleepSchema.parse(req.body)));
  });
  router.get('/:year/:month', async (req, res) => {
    const { year, month } = monthlySleepParamsSchema.parse(req.params);
    const record = await repository.get(year, month);
    if (!record) throw missing();
    res.json(record);
  });
  router.put('/:year/:month', async (req, res) => {
    const { year, month } = monthlySleepParamsSchema.parse(req.params);
    const record = await repository.update(
      year,
      month,
      monthlySleepValuesSchema.parse(req.body),
    );
    if (!record) throw missing();
    res.json(record);
  });
  router.delete('/:year/:month', async (req, res) => {
    const { year, month } = monthlySleepParamsSchema.parse(req.params);
    if (!(await repository.delete(year, month))) throw missing();
    res.status(204).send();
  });
  return router;
};
