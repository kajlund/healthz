import type { ReportingService } from "../reports/service.js";
import type { DashboardLatestSource, DashboardResult } from "./types.js";

export const shiftMonth = (month: string, delta: number) => { const [year, value] = month.split("-").map(Number); const date = new Date(year!, value! - 1 + delta, 1, 12); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };

export class DashboardService {
  constructor(private readonly reports: ReportingService, private readonly latestSource: DashboardLatestSource) {}
  async get(referenceMonth: string): Promise<DashboardResult> {
    const previousMonth = shiftMonth(referenceMonth, -1); const from = shiftMonth(referenceMonth, -11);
    const [trend, latest] = await Promise.all([this.reports.monthly(from, referenceMonth), this.latestSource.load()]);
    return { referenceMonth, previousMonth, latest, currentMonth: trend.at(-1)!, previousMonthData: trend.at(-2)!, trend, generatedAt: new Date().toISOString() };
  }
}
