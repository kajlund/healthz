export type MetricSource = "daily" | "monthly-summary" | "none";
export interface ReportMetric { value: number | null; source: MetricSource; sampleCount: number | null; }
export interface WeightReport { average: ReportMetric; minimum: ReportMetric; maximum: ReportMetric; first: ReportMetric; last: ReportMetric; measurementCount: number; }
export interface BloodPressureReport { averageSystolic: ReportMetric; averageDiastolic: ReportMetric; averagePulse: ReportMetric; readingCount: number; measuredDayCount: number; }
export interface SleepStageCoverage { completeDays: number; partialDays: number; noStageDays: number; }
export interface SleepReport { averageTotalSleepMinutes: ReportMetric; averageAwakeMinutes: ReportMetric; averageAwakeCount: ReportMetric; averageLightMinutes: ReportMetric; averageDeepMinutes: ReportMetric; averageRemMinutes: ReportMetric; averageSleepScore: ReportMetric; stageCoverage: SleepStageCoverage; }
export interface PapReport { averageUsageMinutes: ReportMetric; averageEventsPerHour: ReportMetric; averageMaskSealScore: ReportMetric; averageMaskOnOffCount: ReportMetric; averageTotalScore: ReportMetric; }
export interface MonthlyReport { month: string; weight: WeightReport | null; bloodPressure: BloodPressureReport | null; sleep: SleepReport; pap: PapReport; }

export interface ReportData {
  weights: Array<{ measuredOn: string; weightKg: number }>;
  bloodPressures: Array<{ measuredAt: Date; systolic: number; diastolic: number; pulse: number | null }>;
  sleepRecords: Array<{ sleepDate: string; totalSleepMinutes: number; awakeMinutes: number | null; awakeCount?: number | null; stageCoverage?: "complete" | "partial" | "none"; lightMinutes: number | null; deepMinutes: number | null; remMinutes: number | null; sleepScore: number | null }>;
  papRecords: Array<{ therapyDate: string; healthDate: string | null; usageMinutes: number | null; eventsPerHour: number | null; maskSealScore: number | null; maskOnOffCount: number | null; totalScore: number | null }>;
  monthlySleep: Array<{ summaryMonth: string; averageTotalSleepMinutes: number | null; averageAwakeMinutes: number | null; averageLightMinutes: number | null; averageDeepMinutes: number | null; averageRemMinutes: number | null; averageSleepScore: number | null; daysRecorded: number | null }>;
  monthlyPap: Array<{ summaryMonth: string; averageUsageMinutes: number | null; averageEventsPerHour: number | null; averageMaskSealScore: number | null; averageMaskOnOffCount: number | null; averageTotalScore: number | null; daysRecorded: number | null }>;
}

export interface MonthRange { from: string; to: string; }
export interface ReportingDataSource { load(ranges: MonthRange[]): Promise<ReportData>; }
