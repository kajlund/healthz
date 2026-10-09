import { Router } from "express";
import type { ReportingService } from "./service.js";
import { monthlyReportQuerySchema, yearComparisonQuerySchema } from "./schemas.js";

export const createReportsRouter = (service: ReportingService) => {
  const router = Router();
  router.get("/monthly", async (request, response) => {
    const { from, to } = monthlyReportQuerySchema.parse(request.query);
    const months = await service.monthly(from, to);
    response.json({ meta: { from, to, generatedAt: new Date().toISOString(), monthCount: months.length }, months });
  });
  router.get("/year-over-year", async (request, response) => {
    const years = yearComparisonQuerySchema.parse(request.query);
    const series = await service.yearOverYear(years);
    response.json({ meta: { years, generatedAt: new Date().toISOString(), monthCount: years.length * 12 }, series });
  });
  return router;
};
