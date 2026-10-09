import { calculateMonthlyReports, monthsBetween } from './calculations.js';
import type { MonthRange, ReportingDataSource } from './types.js';

export class ReportingService {
  constructor(private readonly source: ReportingDataSource) {}

  async monthly(from: string, to: string) {
    const months = monthsBetween(from, to);
    return calculateMonthlyReports(
      months,
      await this.source.load([{ from, to }]),
    );
  }

  async yearOverYear(years: number[]) {
    const ranges: MonthRange[] = years.map((year) => ({
      from: `${year}-01`,
      to: `${year}-12`,
    }));
    const data = await this.source.load(ranges);
    return years.map((year) => ({
      year,
      months: calculateMonthlyReports(
        monthsBetween(`${year}-01`, `${year}-12`),
        data,
      ),
    }));
  }
}
