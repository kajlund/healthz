import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { BloodPressureReadingRepository } from '../src/blood-pressure-readings/repository.js';
import type { BodyMeasurementRepository } from '../src/body-measurements/repository.js';
import type { HealthcareEventRepository } from '../src/healthcare-events/repository.js';
import type { HealthcareTagRepository } from '../src/healthcare-tags/repository.js';
import type { PapRecordRepository } from '../src/pap-records/repository.js';
import type { SleepRecordRepository } from '../src/sleep-records/repository.js';
import { TakeoutService } from '../src/takeout/service.js';

const mockBodyRepo: BodyMeasurementRepository = {
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([
    {
      id: '11111111-1111-1111-1111-111111111111',
      measuredOn: '2026-09-20',
      weightKg: 80.5,
      notes: 'Morning',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPressureRepo: BloodPressureReadingRepository = {
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([
    {
      id: '22222222-2222-2222-2222-222222222222',
      measuredAt: new Date('2026-09-20T08:00:00Z'),
      systolic: 120,
      diastolic: 80,
      pulse: 70,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockSleepRepo: SleepRecordRepository = {
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([
    {
      id: '33333333-3333-3333-3333-333333333333',
      sleepDate: '2026-09-19',
      detailMode: 'sessions',
      awakeCount: 1,
      totalSleepMinutes: 480,
      awakeMinutes: 30,
      lightMinutes: 200,
      deepMinutes: 100,
      remMinutes: 150,
      sleepScore: 85,
      source: 'manual',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      sessions: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          sleepRecordId: '33333333-3333-3333-3333-333333333333',
          sessionType: 'main-sleep',
          label: 'Night sleep',
          startedAt: new Date('2026-09-19T23:00:00Z'),
          endedAt: new Date('2026-09-20T07:00:00Z'),
          totalSleepMinutes: 480,
          awakeMinutes: 30,
          awakeCount: 1,
          lightMinutes: 200,
          deepMinutes: 100,
          remMinutes: 150,
          sortOrder: 0,
          source: 'manual',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      stageCoverage: 'complete',
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPapRepo: PapRecordRepository = {
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([
    {
      id: '55555555-5555-5555-5555-555555555555',
      therapyDate: '2026-09-19',
      healthDate: '2026-09-20',
      usageMinutes: 420,
      eventsPerHour: 1.5,
      maskSealScore: 20,
      maskOnOffCount: 1,
      totalScore: 95,
      source: 'manual',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockEventRepo: HealthcareEventRepository = {
  create: vi.fn(),
  list: vi.fn(),
  listAll: vi.fn().mockResolvedValue([
    {
      id: '66666666-6666-6666-6666-666666666666',
      eventDate: '2026-09-21',
      eventTime: '10:30',
      title: 'Dental checkup',
      description: 'Routine cleaning',
      provider: 'Dr. Smith',
      organization: 'Downtown Clinic',
      location: 'Room 101',
      tags: [{ id: '77777777-7777-7777-7777-777777777777', name: 'Dentist' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  dashboard: vi.fn(),
};

const mockTagRepo: HealthcareTagRepository = {
  create: vi.fn(),
  list: vi.fn().mockResolvedValue([
    {
      id: '77777777-7777-7777-7777-777777777777',
      name: 'Dentist',
      normalizedName: 'dentist',
      usageCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('TakeoutService', () => {
  it('exports all repositories with version and counts', async () => {
    const service = new TakeoutService(
      mockBodyRepo,
      mockPressureRepo,
      mockSleepRepo,
      mockPapRepo,
      mockEventRepo,
      mockTagRepo,
    );
    const data = await service.exportAll();

    expect(data.version).toBe(1);
    expect(typeof data.exportedAt).toBe('string');
    expect(data.counts).toEqual({
      bodyMeasurements: 1,
      bloodPressureReadings: 1,
      sleepRecords: 1,
      sleepSessions: 1,
      papRecords: 1,
      healthcareEvents: 1,
      healthcareTags: 1,
    });
    expect(data.bodyMeasurements).toHaveLength(1);
    expect(data.bloodPressureReadings).toHaveLength(1);
    expect(data.sleepRecords).toHaveLength(1);
    expect(data.papRecords).toHaveLength(1);
    expect(data.healthcareEvents).toHaveLength(1);
    expect(data.healthcareTags).toHaveLength(1);
  });
});

describe('Takeout API endpoints', () => {
  const service = new TakeoutService(
    mockBodyRepo,
    mockPressureRepo,
    mockSleepRepo,
    mockPapRepo,
    mockEventRepo,
    mockTagRepo,
  );
  const app = createApp(
    mockBodyRepo,
    mockPressureRepo,
    mockSleepRepo,
    mockPapRepo,
    undefined,
    undefined,
    mockEventRepo,
    mockTagRepo,
    service,
  );

  it('GET /api/takeout returns full takeout JSON', async () => {
    const response = await request(app).get('/api/takeout');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.version).toBe(1);
    expect(response.body.counts.bodyMeasurements).toBe(1);
    expect(response.body.bodyMeasurements).toHaveLength(1);
    expect(response.body.sleepRecords[0].sessions).toHaveLength(1);
  });

  it('GET /api/takeout?download=true sets Content-Disposition header', async () => {
    const response = await request(app).get('/api/takeout?download=true');
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="healthz-takeout-\d{4}-\d{2}-\d{2}\.json"$/,
    );
  });

  it('GET /api/takeout?dataset=body-measurements returns only body measurements', async () => {
    const response = await request(app).get(
      '/api/takeout?dataset=body-measurements&download=true',
    );
    expect(response.status).toBe(200);
    expect(response.body.dataset).toBe('body-measurements');
    expect(response.body.count).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="healthz-body-measurements-\d{4}-\d{2}-\d{2}\.json"$/,
    );
  });

  it('GET /api/takeout?dataset=sleep returns sleep records and session count', async () => {
    const response = await request(app).get('/api/takeout?dataset=sleep');
    expect(response.status).toBe(200);
    expect(response.body.dataset).toBe('sleep');
    expect(response.body.count).toBe(1);
    expect(response.body.sessionCount).toBe(1);
    expect(response.body.items[0].sessions).toHaveLength(1);
  });
});
