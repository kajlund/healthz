import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  cleanHealthcareTagName,
  healthcareTagInputSchema,
  normalizeHealthcareTagName,
} from '../src/healthcare-tags/schemas.js';
import { createHealthcareTagsRouter } from '../src/healthcare-tags/router.js';
import type { HealthcareTagRepository } from '../src/healthcare-tags/repository.js';
import { AppError } from '../src/errors.js';
import express from 'express';

const id = '3bd395b9-6d1d-4e4f-ae88-b06de082f29c';
const tag = {
  id,
  name: 'Doctor',
  normalizedName: 'doctor',
  usageCount: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const app = (repository: HealthcareTagRepository) => {
  const value = express();
  value.use(express.json());
  value.use('/api/healthcare-tags', createHealthcareTagsRouter(repository));
  value.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const item = error as AppError;
      res
        .status(item.status ?? 400)
        .json({ error: { code: item.code, message: item.message } });
    },
  );
  return value;
};
describe('healthcare tag normalization', () => {
  it('trims and collapses whitespace', () =>
    expect(cleanHealthcareTagName('  Blood   donation ')).toBe(
      'Blood donation',
    ));
  it('compares case-insensitively', () =>
    expect(normalizeHealthcareTagName('  DENTIST ')).toBe(
      normalizeHealthcareTagName('dentist'),
    ));
  it('rejects an empty normalized name', () =>
    expect(healthcareTagInputSchema.safeParse({ name: '   ' }).success).toBe(
      false,
    ));
});
describe('healthcare tag routes', () => {
  const repository = (): HealthcareTagRepository => ({
    list: vi.fn().mockResolvedValue([{ ...tag, name: 'Dentistry' }, tag]),
    create: vi.fn().mockResolvedValue({ ...tag, usageCount: 0 }),
    update: vi.fn().mockResolvedValue(tag),
    delete: vi.fn().mockResolvedValue(true),
  });
  it('lists alphabetically in repository order with usage counts', async () => {
    const response = await request(app(repository())).get(
      '/api/healthcare-tags',
    );
    expect(response.body.map((item: typeof tag) => item.name)).toEqual([
      'Dentistry',
      'Doctor',
    ]);
    expect(response.body[1].usageCount).toBe(2);
  });
  it('creates a trimmed tag', async () => {
    const repo = repository();
    await request(app(repo))
      .post('/api/healthcare-tags')
      .send({ name: '  Doctor  ' })
      .expect(201);
    expect(repo.create).toHaveBeenCalledWith({ name: 'Doctor' });
  });
  it('renames a tag', async () => {
    const repo = repository();
    await request(app(repo))
      .put(`/api/healthcare-tags/${id}`)
      .send({ name: 'General practitioner' })
      .expect(200);
    expect(repo.update).toHaveBeenCalledWith(id, {
      name: 'General practitioner',
    });
  });
  it('reports duplicate/conflicting renames', async () => {
    const repo = repository();
    vi.mocked(repo.update).mockRejectedValueOnce(
      new AppError(
        409,
        'CONFLICT',
        'A healthcare tag with this name already exists',
      ),
    );
    expect(
      (
        await request(app(repo))
          .put(`/api/healthcare-tags/${id}`)
          .send({ name: 'Doctor' })
      ).status,
    ).toBe(409);
  });
  it('deletes an unused tag', async () => {
    const repo = repository();
    await request(app(repo)).delete(`/api/healthcare-tags/${id}`).expect(204);
  });
  it('rejects deleting an in-use tag', async () => {
    const repo = repository();
    vi.mocked(repo.delete).mockRejectedValueOnce(
      new AppError(
        409,
        'CONFLICT',
        'This healthcare tag is in use and cannot be deleted',
      ),
    );
    const response = await request(app(repo)).delete(
      `/api/healthcare-tags/${id}`,
    );
    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain('in use');
  });
});
