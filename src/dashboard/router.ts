import { Router } from "express";
import type { DashboardService } from "./service.js";
import { dashboardQuerySchema } from "./schemas.js";
export const createDashboardRouter = (service: DashboardService) => { const router = Router(); router.get("/", async (request, response) => { const { month } = dashboardQuerySchema.parse(request.query); response.json(await service.get(month)); }); return router; };
