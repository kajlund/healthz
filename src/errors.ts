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
    super("A body-weight measurement already exists for this date");
  }
}
