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

export interface SleepRecord {
  id: string;
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

export type SleepRecordInput = Omit<SleepRecord, "id" | "createdAt" | "updatedAt">;

export const sleepRecordsApi = {
  list: () => request<SleepRecord[]>("/api/sleep-records"),
  create: (input: SleepRecordInput) => request<SleepRecord>("/api/sleep-records", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: SleepRecordInput) => request<SleepRecord>(`/api/sleep-records/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/sleep-records/${id}`, { method: "DELETE" }),
};

export interface PapRecord {
  id: string;
  therapyDate: string;
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

export type PapRecordInput = Omit<PapRecord, "id" | "createdAt" | "updatedAt">;

export const papRecordsApi = {
  list: () => request<PapRecord[]>("/api/pap-records"),
  create: (input: PapRecordInput) => request<PapRecord>("/api/pap-records", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: PapRecordInput) => request<PapRecord>(`/api/pap-records/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/pap-records/${id}`, { method: "DELETE" }),
};

export interface MonthlySleepSummary {
  id: string; summaryMonth: string; averageTotalSleepMinutes: number | null;
  averageAwakeMinutes: number | null; averageLightMinutes: number | null;
  averageDeepMinutes: number | null; averageRemMinutes: number | null;
  averageSleepScore: number | null; daysRecorded: number | null; source: string;
  notes: string | null; createdAt: string; updatedAt: string;
}
export type MonthlySleepSummaryInput = Omit<MonthlySleepSummary, "id" | "createdAt" | "updatedAt">;
export interface MonthlyPapSummary {
  id: string; summaryMonth: string; averageUsageMinutes: number | null;
  averageEventsPerHour: number | null; averageMaskSealScore: number | null;
  averageMaskOnOffCount: number | null; averageTotalScore: number | null;
  daysRecorded: number | null; source: string; notes: string | null;
  createdAt: string; updatedAt: string;
}
export type MonthlyPapSummaryInput = Omit<MonthlyPapSummary, "id" | "createdAt" | "updatedAt">;
export const monthlySleepSummariesApi = {
  list: () => request<MonthlySleepSummary[]>("/api/monthly-sleep-summaries"),
  create: (input: MonthlySleepSummaryInput) => request<MonthlySleepSummary>("/api/monthly-sleep-summaries", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: MonthlySleepSummaryInput) => request<MonthlySleepSummary>(`/api/monthly-sleep-summaries/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/monthly-sleep-summaries/${id}`, { method: "DELETE" }),
};
export const monthlyPapSummariesApi = {
  list: () => request<MonthlyPapSummary[]>("/api/monthly-pap-summaries"),
  create: (input: MonthlyPapSummaryInput) => request<MonthlyPapSummary>("/api/monthly-pap-summaries", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: MonthlyPapSummaryInput) => request<MonthlyPapSummary>(`/api/monthly-pap-summaries/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  delete: (id: string) => request<void>(`/api/monthly-pap-summaries/${id}`, { method: "DELETE" }),
};

export type ReportSource = "daily" | "monthly-summary" | "none";
export interface ReportMetric { value: number | null; source: ReportSource; sampleCount: number | null; }
export interface MonthlyReport {
  month: string;
  weight: null | { average: ReportMetric; minimum: ReportMetric; maximum: ReportMetric; first: ReportMetric; last: ReportMetric; measurementCount: number };
  bloodPressure: null | { averageSystolic: ReportMetric; averageDiastolic: ReportMetric; averagePulse: ReportMetric; readingCount: number; measuredDayCount: number };
  sleep: { averageTotalSleepMinutes: ReportMetric; averageAwakeMinutes: ReportMetric; averageLightMinutes: ReportMetric; averageDeepMinutes: ReportMetric; averageRemMinutes: ReportMetric; averageSleepScore: ReportMetric };
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
    sleep: Pick<SleepRecord, "sleepDate" | "totalSleepMinutes" | "sleepScore"> | null;
    pap: Pick<PapRecord, "therapyDate" | "usageMinutes" | "eventsPerHour" | "totalScore"> | null;
  };
  currentMonth: MonthlyReport; previousMonthData: MonthlyReport; trend: MonthlyReport[];
}
export const dashboardApi = { get: (month: string, signal?: AbortSignal) => request<DashboardResponse>(`/api/dashboard?month=${encodeURIComponent(month)}`, { signal }) };
