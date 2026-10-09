export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class BodyMeasurementConflictError extends Error {
  constructor() {
    super('A body-weight measurement already exists for this date');
  }
}

export class SleepRecordConflictError extends Error {
  constructor() {
    super('A sleep record already exists for this sleep date');
  }
}

export class PapRecordConflictError extends Error {
  constructor() {
    super('A PAP record already exists for this therapy date');
  }
}
