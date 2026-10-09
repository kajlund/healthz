import type { ReportingService } from '../reports/service.js';
import type { HealthcareEventRepository } from '../healthcare-events/repository.js';
import type { DashboardLatestSource, DashboardResult } from './types.js';

export const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year!, value! - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export class DashboardService {
  constructor(
    private readonly reports: ReportingService,
    private readonly latestSource: DashboardLatestSource,
    private readonly healthcare?: Pick<HealthcareEventRepository, 'dashboard'>,
  ) {}
  async get(
    referenceMonth: string,
    today = new Date().toISOString().slice(0, 10),
    currentTime = '23:59',
  ): Promise<DashboardResult> {
    const previousMonth = shiftMonth(referenceMonth, -1);
    const from = shiftMonth(referenceMonth, -11);
    const [trend, latest, healthcare] = await Promise.all([
      this.reports.monthly(from, referenceMonth),
      this.latestSource.load(),
      this.healthcare?.dashboard(today, currentTime) ??
        Promise.resolve({ latestPast: null, nextFuture: null }),
    ]);
    return {
      referenceMonth,
      previousMonth,
      latest,
      healthcare,
      currentMonth: trend.at(-1)!,
      previousMonthData: trend.at(-2)!,
      trend,
      generatedAt: new Date().toISOString(),
    };
  }
}
