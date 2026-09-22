import type { BloodPressureReadingRepository } from "../blood-pressure-readings/repository.js";
import type { BodyMeasurementRepository } from "../body-measurements/repository.js";
import type { HealthcareEventRepository } from "../healthcare-events/repository.js";
import type { HealthcareTagRepository } from "../healthcare-tags/repository.js";
import type { PapRecordRepository } from "../pap-records/repository.js";
import type { SleepRecordRepository } from "../sleep-records/repository.js";
import type { TakeoutData } from "./types.js";

export class TakeoutService {
  constructor(
    private readonly bodyMeasurementRepository: BodyMeasurementRepository,
    private readonly bloodPressureReadingRepository: BloodPressureReadingRepository,
    private readonly sleepRecordRepository: SleepRecordRepository,
    private readonly papRecordRepository: PapRecordRepository,
    private readonly healthcareEventRepository?: HealthcareEventRepository,
    private readonly healthcareTagRepository?: HealthcareTagRepository,
  ) {}

  async exportAll(): Promise<TakeoutData> {
    const [bodyMeasurements, bloodPressureReadings, sleepRecords, papRecords, healthcareEvents, healthcareTags] =
      await Promise.all([
        this.bodyMeasurementRepository.list(),
        this.bloodPressureReadingRepository.list(),
        this.sleepRecordRepository.list(),
        this.papRecordRepository.list(),
        this.healthcareEventRepository?.listAll
          ? this.healthcareEventRepository.listAll()
          : this.healthcareEventRepository
          ? this.healthcareEventRepository.list({ page: 1, pageSize: 10_000, tagIds: [], tagMatch: "any", search: "" }).then((p) => p.items)
          : Promise.resolve([]),
        this.healthcareTagRepository ? this.healthcareTagRepository.list() : Promise.resolve([]),
      ]);

    const sleepSessionsCount = sleepRecords.reduce((sum, r) => sum + (r.sessions?.length ?? 0), 0);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        bodyMeasurements: bodyMeasurements.length,
        bloodPressureReadings: bloodPressureReadings.length,
        sleepRecords: sleepRecords.length,
        sleepSessions: sleepSessionsCount,
        papRecords: papRecords.length,
        healthcareEvents: healthcareEvents.length,
        healthcareTags: healthcareTags.length,
      },
      bodyMeasurements,
      bloodPressureReadings,
      sleepRecords,
      papRecords,
      healthcareEvents,
      healthcareTags,
    };
  }
}
