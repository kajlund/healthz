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

export interface DateRangeFilter {
  from?: string;
  to?: string;
}

const dateQuery = (filter?: DateRangeFilter) => {
  const params = new URLSearchParams();
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  const str = params.toString();
  return str ? `?${str}` : "";
};

export const bodyMeasurementsApi = {
  list: (filter?: DateRangeFilter) => request<BodyMeasurement[]>(`/api/body-measurements${dateQuery(filter)}`),
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
  list: (filter?: DateRangeFilter) => request<BloodPressureReading[]>(`/api/blood-pressure-readings${dateQuery(filter)}`),
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

export interface SleepRecord {
  id: string;
  detailMode: "summary" | "sessions";
  awakeCount: number | null;
  stageCoverage: "complete" | "partial" | "none";
  sessions: SleepSession[];
  sleepDate: string;
  totalSleepMinutes: number;
  awakeMinutes: number | null;
  lightMinutes: number | null;
  deepMinutes: number | null;
  remMinutes: number | null;
  sleepScore: number | null;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type { SleepRecordInput, SleepSessionInput } from "../src/sleep-records/schemas.js";
import type { SleepRecordInput } from "../src/sleep-records/schemas.js";
export interface SleepSession {
  id: string;
  sleepRecordId: string;
  sessionType: "main-sleep" | "nap" | "other";
  label: string | null;
  startedAt: string | null;
  endedAt: string | null;
  totalSleepMinutes: number;
  awakeMinutes: number | null;
  awakeCount: number | null;
  lightMinutes: number | null;
  deepMinutes: number | null;
  remMinutes: number | null;
  sortOrder: number;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export const sleepRecordsApi = {
  get: (id: string) => request<SleepRecord>(`/api/sleep-records/${encodeURIComponent(id)}`),
  list: (filter?: DateRangeFilter) => request<SleepRecord[]>(`/api/sleep-records${dateQuery(filter)}`),
  create: (input: SleepRecordInput) => request<SleepRecord>("/api/sleep-records", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: SleepRecordInput) => request<SleepRecord>(`/api/sleep-records/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/sleep-records/${id}`, { method: "DELETE" }),
};

export interface PapRecord {
  id: string;
  therapyDate: string;
  healthDate: string | null;
  usageMinutes: number | null;
  eventsPerHour: number | null;
  maskSealScore: number | null;
  maskOnOffCount: number | null;
  totalScore: number | null;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PapRecordInput = Omit<PapRecord, "id" | "createdAt" | "updatedAt" | "healthDate"> & { healthDate: string };

export const papRecordsApi = {
  list: (filter?: DateRangeFilter) => request<PapRecord[]>(`/api/pap-records${dateQuery(filter)}`),
  create: (input: PapRecordInput) => request<PapRecord>("/api/pap-records", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: PapRecordInput) => request<PapRecord>(`/api/pap-records/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/pap-records/${id}`, { method: "DELETE" }),
};

export type MonthlySleepAverage = Omit<import("../src/sleep-monthly-averages/repository.js").MonthlySleepAverage, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export const monthlySleepApi = {
  list: () => request<MonthlySleepAverage[]>("/api/sleep-monthly-averages"),
  create: (input: import("../src/sleep-monthly-averages/schemas.js").MonthlySleepInput) => request<MonthlySleepAverage>("/api/sleep-monthly-averages", { method: "POST", body: JSON.stringify(input) }),
  update: (year: number, month: number, input: import("../src/sleep-monthly-averages/schemas.js").MonthlySleepValues) => request<MonthlySleepAverage>(`/api/sleep-monthly-averages/${year}/${month}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (year: number, month: number) => request<void>(`/api/sleep-monthly-averages/${year}/${month}`, { method: "DELETE" }),
};
export type ReportSource = import("../src/reports/types.js").MetricSource;
export type ReportMetric = import("../src/reports/types.js").ReportMetric;
export interface MonthlyReport {
  month: string;
  weight: null | { average: ReportMetric; minimum: ReportMetric; maximum: ReportMetric; first: ReportMetric; last: ReportMetric; measurementCount: number };
  bloodPressure: null | { averageSystolic: ReportMetric; averageDiastolic: ReportMetric; averagePulse: ReportMetric; readingCount: number; measuredDayCount: number };
  sleep: import("../src/reports/types.js").SleepReport;
  pap: { averageUsageMinutes: ReportMetric; averageEventsPerHour: ReportMetric; averageMaskSealScore: ReportMetric; averageMaskOnOffCount: ReportMetric; averageTotalScore: ReportMetric };
}
export interface MonthlyReportResponse { meta: { from: string; to: string; generatedAt: string; monthCount: number }; months: MonthlyReport[]; }
export interface YearReportResponse { meta: { years: number[]; generatedAt: string; monthCount: number }; series: Array<{ year: number; months: MonthlyReport[] }>; }
export const reportsApi = {
  monthly: (from: string, to: string) => request<MonthlyReportResponse>(`/api/reports/monthly?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  yearOverYear: (years: number[]) => request<YearReportResponse>(`/api/reports/year-over-year?years=${years.join(",")}`),
};
export interface DashboardResponse {
  referenceMonth: string; previousMonth: string; generatedAt: string;
  latest: {
    weight: Pick<BodyMeasurement, "measuredOn" | "weightKg"> | null;
    bloodPressure: Pick<BloodPressureReading, "measuredAt" | "systolic" | "diastolic" | "pulse"> | null;
    sleep: import("../src/dashboard/types.js").DashboardLatest["sleep"];
    pap: Pick<PapRecord, "therapyDate" | "healthDate" | "usageMinutes" | "eventsPerHour" | "totalScore"> | null;
  };
  healthcare: { latestPast: HealthcareEvent | null; nextFuture: HealthcareEvent | null };
  currentMonth: MonthlyReport; previousMonthData: MonthlyReport; trend: MonthlyReport[];
}
export const dashboardApi = { get: (month: string, today: string, currentTime: string, signal?: AbortSignal) => request<DashboardResponse>(`/api/dashboard?month=${encodeURIComponent(month)}&today=${encodeURIComponent(today)}&currentTime=${encodeURIComponent(currentTime)}`, { signal }) };

export interface HealthcareTag { id: string; name: string; usageCount: number; createdAt: string; updatedAt: string; }
export interface HealthcareEvent {
  id: string; eventDate: string; eventTime: string | null; title: string; description: string | null;
  provider: string | null; organization: string | null; location: string | null;
  tags: Array<Pick<HealthcareTag, "id" | "name">>; createdAt: string; updatedAt: string;
}
export interface HealthcareEventInput {
  eventDate: string; eventTime: string | null; title: string; description: string | null;
  provider: string | null; organization: string | null; location: string | null; tagIds: string[];
}
export interface HealthcareEventPage { items: HealthcareEvent[]; total: number; latestEventDate: string | null; page: number; pageSize: number; }
export const healthcareTagsApi = {
  list: () => request<HealthcareTag[]>("/api/healthcare-tags"),
  create: (name: string) => request<HealthcareTag>("/api/healthcare-tags", { method: "POST", body: JSON.stringify({ name }) }),
  update: (id: string, name: string) => request<HealthcareTag>(`/api/healthcare-tags/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  delete: (id: string) => request<void>(`/api/healthcare-tags/${id}`, { method: "DELETE" }),
};
export const healthcareEventsApi = {
  list: (query: string, signal?: AbortSignal) => request<HealthcareEventPage>(`/api/healthcare-events${query ? `?${query}` : ""}`, { signal }),
  create: (input: HealthcareEventInput) => request<HealthcareEvent>("/api/healthcare-events", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: HealthcareEventInput) => request<HealthcareEvent>(`/api/healthcare-events/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/healthcare-events/${id}`, { method: "DELETE" }),
};

export interface TakeoutCounts {
  bodyMeasurements: number;
  bloodPressureReadings: number;
  sleepRecords: number;
  sleepSessions: number;
  papRecords: number;
  healthcareEvents: number;
  healthcareTags: number;
}

export interface TakeoutData {
  version: 1;
  exportedAt: string;
  counts: TakeoutCounts;
  bodyMeasurements: BodyMeasurement[];
  bloodPressureReadings: BloodPressureReading[];
  sleepRecords: SleepRecord[];
  papRecords: PapRecord[];
  healthcareEvents: HealthcareEvent[];
  healthcareTags: HealthcareTag[];
}

export const takeoutApi = {
  get: (dataset?: string, signal?: AbortSignal) =>
    request<TakeoutData>(`/api/takeout${dataset ? `?dataset=${encodeURIComponent(dataset)}` : ""}`, { signal }),
  downloadUrl: (dataset?: string) =>
    `/api/takeout?download=true${dataset ? `&dataset=${encodeURIComponent(dataset)}` : ""}`,
};

