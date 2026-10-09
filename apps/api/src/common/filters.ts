import { z } from "zod";

export const dateRangeQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from date").optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to date").optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "From date must be on or before To date",
    path: ["to"],
  });

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

const daysInMonth = (year: number, month: number) =>
  month === 2
    ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
    : [4, 6, 9, 11].includes(month)
    ? 30
    : 31;

export const followingCalendarDay = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return "";
  day++;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
