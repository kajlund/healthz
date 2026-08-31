import type { MonthlyReport } from "../reports/types.js";
import type { HealthcareDashboardEvents } from "../healthcare-events/repository.js";

export interface DashboardLatest {
  weight: { measuredOn: string; weightKg: number } | null;
  bloodPressure: { measuredAt: Date; systolic: number; diastolic: number; pulse: number | null } | null;
  sleep: { sleepDate: string; totalSleepMinutes: number; sleepScore: number | null } | null;
  pap: { therapyDate: string; healthDate: string | null; usageMinutes: number | null; eventsPerHour: number | null; totalScore: number | null } | null;
}
export interface DashboardLatestSource { load(): Promise<DashboardLatest>; }
export interface DashboardResult { referenceMonth: string; previousMonth: string; latest: DashboardLatest; healthcare: HealthcareDashboardEvents; currentMonth: MonthlyReport; previousMonthData: MonthlyReport; trend: MonthlyReport[]; generatedAt: string; }
