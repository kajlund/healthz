export type ImportMode = "pap" | "ohealth";

export interface PapImportValue {
  therapyDate: string;
  healthDate: string;
  usageMinutes: number;
  eventsPerHour: number | null;
  maskSealScore: number | null;
  maskOnOffCount: number | null;
  totalScore: number | null;
  source: string;
  notes: null;
}

export interface SleepImportValue {
  sleepDate: string;
  totalSleepMinutes: number;
  awakeMinutes: number;
  lightMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  sleepScore: null;
  source: string;
  notes: null;
}

export interface InvalidRecord { sourceRow: number; reason: string; values: unknown; }
export interface BoundaryShift { sourceRow: number; from: string; to: string; boundary: "month" | "year"; }

export const addCalendarDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const localDateAt = (epochMs: number, offsetSeconds: number) =>
  new Date(epochMs + offsetSeconds * 1000).toISOString().slice(0, 10);

export const boundaryShift = (sourceRow: number, from: string, to: string): BoundaryShift | null => {
  if (from.slice(0, 4) !== to.slice(0, 4)) return { sourceRow, from, to, boundary: "year" };
  if (from.slice(0, 7) !== to.slice(0, 7)) return { sourceRow, from, to, boundary: "month" };
  return null;
};

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("CSV ends inside a quoted field");
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
};

const finiteNumber = (value: string, name: string) => {
  if (value.trim() === "") throw new Error(`${name} is empty`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} is not numeric`);
  return parsed;
};

const integer = (value: string, name: string) => {
  const parsed = finiteNumber(value, name);
  if (!Number.isInteger(parsed)) throw new Error(`${name} is not an integer`);
  return parsed;
};

const optionalNumber = (value: string, name: string) => value.trim() === "" ? null : finiteNumber(value, name);
const optionalInteger = (value: string, name: string) => value.trim() === "" ? null : integer(value, name);

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

export const parsePapCsv = (text: string) => {
  const rows = parseCsv(text);
  const headers = rows.shift();
  if (!headers) throw new Error("PAP CSV is empty");
  const required = ["session_date", "Usage hours", "Sleep score", "leak_score", "mask_session_count", "ahi"];
  const columns = Object.fromEntries(headers.map((header, index) => [header, index]));
  for (const name of required) if (columns[name] === undefined) throw new Error(`PAP CSV is missing column: ${name}`);

  const records: Array<{ sourceRow: number; value: PapImportValue }> = [];
  const invalid: InvalidRecord[] = [];
  const boundaryShifts: BoundaryShift[] = [];
  const zeroUsage: number[] = [];
  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    try {
      const read = (name: string) => row[columns[name]!] ?? "";
      const therapyDate = read("session_date").trim();
      if (!validDate(therapyDate)) throw new Error("session_date is not a valid YYYY-MM-DD date");
      const usageMinutes = Math.round(finiteNumber(read("Usage hours"), "Usage hours") * 60);
      const value: PapImportValue = {
        therapyDate,
        healthDate: addCalendarDays(therapyDate, 1),
        usageMinutes,
        eventsPerHour: optionalNumber(read("ahi"), "ahi"),
        maskSealScore: optionalInteger(read("leak_score"), "leak_score"),
        maskOnOffCount: optionalInteger(read("mask_session_count"), "mask_session_count"),
        totalScore: optionalInteger(read("Sleep score"), "Sleep score"),
        source: "ResMed myAir import",
        notes: null,
      };
      if (usageMinutes < 0 || usageMinutes > 1440) throw new Error("Usage hours is outside 0–24 hours");
      if (value.eventsPerHour !== null && value.eventsPerHour < 0) throw new Error("ahi is negative");
      if ((value.maskSealScore !== null && value.maskSealScore < 0) || (value.maskOnOffCount !== null && value.maskOnOffCount < 0)) throw new Error("PAP score/count is negative");
      if (value.totalScore !== null && (value.totalScore < 0 || value.totalScore > 100)) throw new Error("Sleep score is outside 0–100");
      records.push({ sourceRow, value });
      if (usageMinutes === 0) zeroUsage.push(sourceRow);
      const shift = boundaryShift(sourceRow, value.therapyDate, value.healthDate);
      if (shift) boundaryShifts.push(shift);
    } catch (error) {
      invalid.push({ sourceRow, reason: error instanceof Error ? error.message : String(error), values: row });
    }
  });
  return { records, invalid, boundaryShifts, zeroUsage, sourceCount: rows.length };
};

export const papMeasurementsEqual = (left: PapImportValue, right: {
  therapyDate: string; healthDate: string | null; usageMinutes: number | null;
  eventsPerHour: number | null; maskSealScore: number | null; maskOnOffCount: number | null; totalScore: number | null;
}) =>
  left.therapyDate === right.therapyDate && left.healthDate === right.healthDate
  && left.usageMinutes === right.usageMinutes && left.eventsPerHour === right.eventsPerHour
  && left.maskSealScore === right.maskSealScore && left.maskOnOffCount === right.maskOnOffCount
  && left.totalScore === right.totalScore;

export const sleepMeasurementsEqual = (left: SleepImportValue, right: {
  sleepDate: string; totalSleepMinutes: number; awakeMinutes: number | null; lightMinutes: number | null;
  deepMinutes: number | null; remMinutes: number | null; sleepScore: number | null;
}) =>
  left.sleepDate === right.sleepDate && left.totalSleepMinutes === right.totalSleepMinutes
  && left.awakeMinutes === right.awakeMinutes && left.lightMinutes === right.lightMinutes
  && left.deepMinutes === right.deepMinutes && left.remMinutes === right.remMinutes
  && left.sleepScore === right.sleepScore;

export const dateRange = (dates: string[]) => dates.length === 0
  ? null
  : { from: dates.reduce((a, b) => a < b ? a : b), to: dates.reduce((a, b) => a > b ? a : b) };
