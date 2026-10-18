import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sleepMetricSettings } from '../db/schema.js';
import { sleepMetricDefinitions, sleepSources } from './metrics.js';

export const createSleepSettingsRouter = (database = db) => {
  const router = Router();
  router.get('/', async (_request, response) => {
    const settings = await database
      .select()
      .from(sleepMetricSettings)
      .orderBy(asc(sleepMetricSettings.displayOrder));
    response.json(
      sleepMetricDefinitions
        .map((definition) => ({
          ...definition,
          ...settings.find((s) => s.key === definition.key),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    );
  });
  router.put('/:key', async (request, response) => {
    const key = z
      .enum(sleepMetricDefinitions.map((d) => d.key) as [string, ...string[]])
      .parse(request.params.key);
    const input = z
      .object({
        enabled: z.boolean(),
        displayOrder: z.number().int().min(0).max(1000),
        sources: z.array(z.enum(sleepSources.map((s) => s.key))).max(3),
      })
      .strict()
      .parse(request.body);
    await database
      .insert(sleepMetricSettings)
      .values({ key, ...input })
      .onConflictDoUpdate({ target: sleepMetricSettings.key, set: input });
    response.json(
      (
        await database
          .select()
          .from(sleepMetricSettings)
          .where(eq(sleepMetricSettings.key, key))
      )[0],
    );
  });
  return router;
};
