export interface BodyMeasurement {
  id: string;
  measuredOn: string;
  weightKg: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurementInput {
  measuredOn: string;
  weightKg: number;
  notes?: string | null;
}

interface ApiErrorBody {
  error?: { message?: string };
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: options?.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options?.headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? "Something went wrong. Please try again.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const bodyMeasurementsApi = {
  list: () => request<BodyMeasurement[]>("/api/body-measurements"),
  create: (input: BodyMeasurementInput) =>
    request<BodyMeasurement>("/api/body-measurements", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: BodyMeasurementInput) =>
    request<BodyMeasurement>(`/api/body-measurements/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  delete: (id: string) =>
    request<void>(`/api/body-measurements/${id}`, { method: "DELETE" }),
};

export interface BloodPressureReading {
  id: string;
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloodPressureReadingInput {
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  notes?: string | null;
}

export const bloodPressureReadingsApi = {
  list: () => request<BloodPressureReading[]>("/api/blood-pressure-readings"),
  create: (input: BloodPressureReadingInput) =>
    request<BloodPressureReading>("/api/blood-pressure-readings", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: BloodPressureReadingInput) =>
    request<BloodPressureReading>(`/api/blood-pressure-readings/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  delete: (id: string) =>
    request<void>(`/api/blood-pressure-readings/${id}`, { method: "DELETE" }),
};
