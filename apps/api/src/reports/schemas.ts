import { z } from "zod";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Must be a month in YYYY-MM format");
export const monthlyReportQuerySchema = z.object({ from: month, to: month }).strict().superRefine(({ from, to }, context) => {
  if (from > to) context.addIssue({ code: "custom", message: "From month must not be after to month", path: ["from"] });
  const [fy, fm] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number);
  if ((ty! - fy!) * 12 + tm! - fm! + 1 > 120) context.addIssue({ code: "custom", message: "Report range cannot exceed 120 months", path: ["to"] });
});
export const yearComparisonQuerySchema = z.object({ years: z.string().min(1) }).strict().transform(({ years }, context) => {
  const parts = years.split(",").map((value) => value.trim());
  if (parts.some((value) => !/^\d{4}$/.test(value))) { context.addIssue({ code: "custom", message: "Years must be comma-separated four-digit years", path: ["years"] }); return z.NEVER; }
  const values = [...new Set(parts.map(Number))].sort((a, b) => a - b);
  if (values.length > 10) { context.addIssue({ code: "custom", message: "Cannot compare more than 10 years", path: ["years"] }); return z.NEVER; }
  return values;
});
