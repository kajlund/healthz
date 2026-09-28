import { createSleepRecordSchema } from "../src/sleep-records/schemas.js";
import { aggregateSessions, stageCoverage } from "../src/sleep-records/service.js";
import type { SleepRecord, SleepRecordInput, SleepSession, SleepSessionInput } from "./api.js";
import { previousCalendarDay } from "./pap-date.js";

export type DetailMode = "summary" | "sessions";
export type DurationKey = "totalSleepMinutes" | "awakeMinutes" | "lightMinutes" | "deepMinutes" | "remMinutes";
export type StageDurationKey = "totalSleepMinutes" | "lightMinutes" | "deepMinutes" | "remMinutes";
export type DurationDraft = string | { hours: string; minutes: string };
export type MeasurementsDraft = {
  totalSleepMinutes: DurationDraft;
  lightMinutes: DurationDraft;
  deepMinutes: DurationDraft;
  remMinutes: DurationDraft;
  awakeMinutes: string;
  awakeCount: string;
};
export type SessionDraft = MeasurementsDraft & {
  key: string; sessionType: SleepSessionInput["sessionType"]; label: string; source: string;
  startedAt: string; endedAt: string; originalStartedAt?: string | null; originalEndedAt?: string | null; detailsOpen: boolean;
};
export interface SleepDraft {
  id: string | null; originalMode: DetailMode; detailMode: DetailMode; sleepDate: string;
  summary: MeasurementsDraft; sessions: SessionDraft[]; sleepScore: string; source: string; notes: string;
}
export const stageDurationKeys: StageDurationKey[] = ["totalSleepMinutes", "lightMinutes", "deepMinutes", "remMinutes"];
export const durationKeys: DurationKey[] = ["totalSleepMinutes", "awakeMinutes", "lightMinutes", "deepMinutes", "remMinutes"];
export const coverageLabels = { complete: "Complete stage data", partial: "Partial stage data", none: "No stage data" };
export const typeLabels = { "main-sleep": "Main sleep", nap: "Nap", other: "Other" };
export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
export const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export const durationDraft = (value: number | null | undefined): string =>
  value == null ? "" : `${pad(Math.floor(value / 60))}${pad(value % 60)}`;

export const parseDurationDraft = (val: number | string | { hours?: string; minutes?: string } | null | undefined): string => {
  if (val == null) return "";
  if (typeof val === "number") return durationDraft(val);
  if (typeof val === "object") {
    const h = Number(val.hours || 0);
    const m = Number(val.minutes || 0);
    return val.hours === "" && val.minutes === "" ? "" : `${pad(h)}${pad(m)}`;
  }
  return String(val);
};

export const parseMinutesValue = (val: number | string | DurationDraft | null | undefined): string => {
  if (val == null) return "";
  if (typeof val === "object" && "minutes" in val) {
    const h = Number(val.hours || 0);
    const m = Number(val.minutes || 0);
    return val.hours === "" && val.minutes === "" ? "" : String(h * 60 + m);
  }
  return String(val);
};

type Measurements = { [K in DurationKey]?: number | string | DurationDraft | null } & { awakeCount?: number | string | null };
export const measurementDraft = (values: Measurements = {}): MeasurementsDraft => ({
  totalSleepMinutes: parseDurationDraft(values.totalSleepMinutes),
  awakeMinutes: parseMinutesValue(values.awakeMinutes),
  lightMinutes: parseDurationDraft(values.lightMinutes),
  deepMinutes: parseDurationDraft(values.deepMinutes),
  remMinutes: parseDurationDraft(values.remMinutes),
  awakeCount: values.awakeCount == null ? "" : String(values.awakeCount),
});
let nextKey = 0;
export const newSession = (sessionType: SessionDraft["sessionType"] = "main-sleep"): SessionDraft => ({
  ...measurementDraft(), key: `sleep-session-${++nextKey}`, sessionType, label: "", source: "", startedAt: "", endedAt: "", detailsOpen: sessionType === "main-sleep",
});
export const localDateTime = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};

export interface ParsedDateTime {
  iso: string;
  display: string;
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

export const formatDateTimeDisplay = (value: string): string => {
  if (!value) return "";
  const parsed = parseFlexibleDateTime(value);
  if (parsed) return parsed.display;
  return value;
};

export const parseFlexibleDateTime = (raw: string, defaultDate?: string): ParsedDateTime | null => {
  const text = raw.trim();
  if (!text) return null;

  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;
  let hours: number | undefined;
  let minutes: number | undefined;

  // 1. Time only with colon: H:MM or HH:MM (e.g. "23:00", "7:30")
  const timeOnlyColonMatch = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (timeOnlyColonMatch) {
    hours = Number(timeOnlyColonMatch[1]);
    minutes = Number(timeOnlyColonMatch[2]);
  }

  // 2. Time only 3 or 4 digits without colon (e.g. "2300", "730", "0730")
  if (hours === undefined) {
    const timeOnlyDigitsMatch = /^(\d{1,2})(\d{2})$/.exec(text);
    if (timeOnlyDigitsMatch && text.length <= 4) {
      const h = Number(timeOnlyDigitsMatch[1]);
      const m = Number(timeOnlyDigitsMatch[2]);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hours = h;
        minutes = m;
      }
    }
  }

  // If time-only was matched, use defaultDate
  if (hours !== undefined && defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate)) {
    const [y, m, d] = defaultDate.split("-").map(Number);
    year = y;
    month = m;
    day = d;
  }

  // 3. Compact 12 digits: YYYYMMDDHHMM (e.g. "202609262300")
  if (year === undefined) {
    const compact12Match = /^(\d{4})(\d{2})(\d{2})[\sT]?(\d{2})(\d{2})$/.exec(text);
    if (compact12Match) {
      year = Number(compact12Match[1]);
      month = Number(compact12Match[2]);
      day = Number(compact12Match[3]);
      hours = Number(compact12Match[4]);
      minutes = Number(compact12Match[5]);
    }
  }

  // 4. Compact date + time: YYYYMMDD followed by separator and time (e.g. "20260926 23:00", "20260926 2300")
  if (year === undefined) {
    const compactDateMatch = /^(\d{4})(\d{2})(\d{2})[\sT](\d{1,2}):?(\d{2})$/.exec(text);
    if (compactDateMatch) {
      year = Number(compactDateMatch[1]);
      month = Number(compactDateMatch[2]);
      day = Number(compactDateMatch[3]);
      hours = Number(compactDateMatch[4]);
      minutes = Number(compactDateMatch[5]);
    }
  }

  // 5. Date with delimiters (- / . :): YYYY-MM-DD, YYYY:MM:DD, YYYY/MM/DD, YYYY.MM.DD followed by time
  if (year === undefined) {
    const delimitedMatch = /^(\d{4})[-/.:](\d{1,2})[-/.:](\d{1,2})(?:[\sT:](\d{1,2}):?(\d{2}))?$/.exec(text);
    if (delimitedMatch) {
      year = Number(delimitedMatch[1]);
      month = Number(delimitedMatch[2]);
      day = Number(delimitedMatch[3]);
      hours = delimitedMatch[4] !== undefined ? Number(delimitedMatch[4]) : 0;
      minutes = delimitedMatch[5] !== undefined ? Number(delimitedMatch[5]) : 0;
    }
  }

  if (year === undefined || month === undefined || day === undefined || hours === undefined || minutes === undefined) {
    return null;
  }

  if (year < 1000 || year > 9999 || month < 1 || month > 12 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const dateObj = new Date(year, month - 1, day);
  if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
    return null;
  }

  const p = (n: number) => String(n).padStart(2, "0");
  const iso = `${year}-${p(month)}-${p(day)}T${p(hours)}:${p(minutes)}`;
  const display = `${year}${p(month)}${p(day)} ${p(hours)}${p(minutes)}`;

  return { iso, display, year, month, day, hours, minutes };
};

export const sessionIntervalMinutes = (startedAt: string, endedAt: string): number | null => {
  if (!startedAt || !endedAt) return null;
  const start = parseFlexibleDateTime(startedAt);
  const end = parseFlexibleDateTime(endedAt);
  if (!start || !end) return null;
  const startDate = new Date(start.year, start.month - 1, start.day, start.hours, start.minutes);
  const endDate = new Date(end.year, end.month - 1, end.day, end.hours, end.minutes);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMin = Math.round(diffMs / 60000);
  return diffMin > 0 ? diffMin : null;
};

export const serializeLocalTime = (value: string, original?: string | null): string | null => {
  if (!value) return null;
  const parsed = parseFlexibleDateTime(value);
  const normalizedValue = parsed ? parsed.iso : (value.includes(" ") ? value.replace(" ", "T") : value);
  const normalized = normalizedValue.length === 16 ? `${normalizedValue}:00.000` : normalizedValue.length === 19 ? `${normalizedValue}.000` : normalizedValue.replace(/\.(\d{1,3})$/, (_, fraction: string) => `.${fraction.padEnd(3, "0")}`);
  // Preserve the original instant, including during a repeated daylight-saving hour.
  if (original && (normalizedValue.length === 16 ? localDateTime(original).slice(0, 16) === normalizedValue : localDateTime(original) === normalized)) return original;
  const date = new Date(normalizedValue);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(normalizedValue) || Number.isNaN(date.valueOf()) || localDateTime(date) !== normalized) {
    throw new Error("Enter a valid local date and time. This time may not exist because of a clock change.");
  }
  return date.toISOString();
};
export const sessionDraft = (session: SleepSession): SessionDraft => ({
  ...newSession(session.sessionType), ...measurementDraft(session), label: session.label ?? "", source: session.source ?? "",
  startedAt: session.startedAt ? localDateTime(session.startedAt).slice(0, 16) : "", endedAt: session.endedAt ? localDateTime(session.endedAt).slice(0, 16) : "",
  originalStartedAt: session.startedAt, originalEndedAt: session.endedAt,
  detailsOpen: session.sessionType === "main-sleep" || [session.startedAt, session.endedAt, session.label, session.source, session.awakeCount, session.awakeMinutes, session.deepMinutes, session.lightMinutes, session.remMinutes].some((value) => value != null && value !== ""),
});
export const defaultMainSleepTimes = (toDate: string) => {
  const fromDate = previousCalendarDay(toDate);
  return {
    startedAt: fromDate ? `${fromDate}T23:00` : "",
    endedAt: `${toDate}T07:00`,
  };
};
export const firstSessionToDate = (draft: { sleepDate: string; sessions: Array<Pick<SessionDraft, "endedAt">> }): string => {
  const firstEndedAt = draft.sessions[0]?.endedAt;
  if (firstEndedAt) {
    const parsed = parseFlexibleDateTime(firstEndedAt);
    if (parsed) return `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(firstEndedAt)) return firstEndedAt.slice(0, 10);
  }
  return draft.sleepDate;
};
export const syncNapDates = (sessions: SessionDraft[], toDate: string): SessionDraft[] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return sessions;
  return sessions.map((session, index) => {
    if (index === 0 || session.sessionType !== "nap" || (!session.startedAt && !session.endedAt)) return session;
    const startParsed = session.startedAt ? parseFlexibleDateTime(session.startedAt) : null;
    const endParsed = session.endedAt ? parseFlexibleDateTime(session.endedAt) : null;
    return {
      ...session,
      startedAt: startParsed ? `${toDate}T${pad(startParsed.hours)}:${pad(startParsed.minutes)}` : session.startedAt,
      endedAt: endParsed ? `${toDate}T${pad(endParsed.hours)}:${pad(endParsed.minutes)}` : session.endedAt,
    };
  });
};
export const newSleepDraft = (initialDate?: string): SleepDraft => {
  const sleepDate = initialDate ?? localDateTime(new Date()).slice(0, 10);
  return {
    id: null, originalMode: "sessions", detailMode: "sessions", sleepDate,
    summary: measurementDraft(),
    sessions: [{
      ...newSession("main-sleep"),
      ...defaultMainSleepTimes(sleepDate),
    }],
    sleepScore: "", source: "manual", notes: "",
  };
};
export const draftFromRecord = (record: SleepRecord): SleepDraft => ({
  id: record.id, originalMode: record.detailMode, detailMode: record.detailMode, sleepDate: record.sleepDate,
  summary: measurementDraft(record), sessions: record.sessions.map(sessionDraft), sleepScore: record.sleepScore == null ? "" : String(record.sleepScore),
  source: record.source, notes: record.notes ?? "",
});
export const optionalInteger = (value: string): number | null => value.trim() === "" ? null : Number(value);
export const optionalMinutes = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};
export const durationValue = (val: DurationDraft | number | null | undefined): number | null => {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "object") {
    const { hours, minutes } = val;
    if (hours === "" && minutes === "") return null;
    const h = Number(hours || 0), m = Number(minutes || 0);
    return Number.isInteger(h) && h >= 0 && Number.isInteger(m) && m >= 0 && m <= 59 ? h * 60 + m : NaN;
  }
  const text = String(val).trim();
  if (!text) return null;

  // 4 digits: e.g. "0700", "0730", "0040"
  if (/^\d{4}$/.test(text)) {
    const h = Number(text.slice(0, 2));
    const m = Number(text.slice(2, 4));
    return m <= 59 ? h * 60 + m : NaN;
  }

  // 3 digits: e.g. "730" -> 7h 30m, "115" -> 1h 15m
  if (/^\d{3}$/.test(text)) {
    const h = Number(text.slice(0, 1));
    const m = Number(text.slice(1, 3));
    return m <= 59 ? h * 60 + m : NaN;
  }

  // Colon: "H:MM" or "HH:MM" e.g. "7:30", "07:30", "0:45"
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hStr, mStr] = text.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    return m <= 59 ? h * 60 + m : NaN;
  }

  // Human format: "7h", "1h 30m", "45m"
  if (/^\d+\s*h(\s*\d+\s*m)?$/i.test(text) || /^\d+\s*m$/i.test(text)) {
    const hMatch = /(\d+)\s*h/i.exec(text);
    const mMatch = /(\d+)\s*m/i.exec(text);
    const h = hMatch ? Number(hMatch[1]) : 0;
    const m = mMatch ? Number(mMatch[1]) : 0;
    return m <= 59 ? h * 60 + m : NaN;
  }

  // 1 or 2 digits: e.g. "7" or "8" (hours if <= 24; minutes if > 24 and <= 59)
  if (/^\d{1,2}$/.test(text)) {
    const n = Number(text);
    if (n <= 24) return n * 60;
    if (n <= 59) return n;
    return NaN;
  }

  return NaN;
};

export const formatHHMM = (value: string | number | null | undefined): string => {
  const minutes = typeof value === "number" ? value : durationValue(value);
  if (minutes == null || Number.isNaN(minutes)) return typeof value === "string" ? value : "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad(h)}${pad(m)}`;
};

const measurements = (draft: MeasurementsDraft) => ({
  totalSleepMinutes: durationValue(draft.totalSleepMinutes), awakeMinutes: optionalMinutes(draft.awakeMinutes),
  awakeCount: optionalInteger(draft.awakeCount), lightMinutes: durationValue(draft.lightMinutes),
  deepMinutes: durationValue(draft.deepMinutes), remMinutes: durationValue(draft.remMinutes),
});
const known = (value: number | null) => value !== null && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
export const previewSessions = (sessions: SessionDraft[]) => {
  const rows = sessions.map((session, sortOrder) => {
    const values = measurements(session);
    return { sessionType: session.sessionType, sortOrder, totalSleepMinutes: known(values.totalSleepMinutes) ? values.totalSleepMinutes! : 0,
      awakeMinutes: known(values.awakeMinutes) ? values.awakeMinutes : null, awakeCount: known(values.awakeCount) ? values.awakeCount : null,
      lightMinutes: known(values.lightMinutes) ? values.lightMinutes : null, deepMinutes: known(values.deepMinutes) ? values.deepMinutes : null,
      remMinutes: known(values.remMinutes) ? values.remMinutes : null };
  });
  const aggregate = rows.length ? aggregateSessions(rows) : { totalSleepMinutes: 0, awakeMinutes: null, awakeCount: null, lightMinutes: null, deepMinutes: null, remMinutes: null };
  return { ...aggregate, totalSleepMinutes: rows.length && rows.every((row) => row.totalSleepMinutes > 0) ? aggregate.totalSleepMinutes : null, stageCoverage: stageCoverage(rows) };
};
export const moveSession = (sessions: SessionDraft[], index: number, direction: -1 | 1): SessionDraft[] => {
  const target = index + direction;
  if (target < 0 || target >= sessions.length) return sessions;
  const result = [...sessions];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
};
export const removeSession = (sessions: SessionDraft[], key: string) => sessions.length > 1 ? sessions.filter((session) => session.key !== key) : sessions;

export type FieldErrors = Record<string, string>;
export const validateDraft = (draft: SleepDraft): { input?: SleepRecordInput; errors: FieldErrors } => {
  const errors: FieldErrors = {};
  const readMeasurements = (row: MeasurementsDraft, prefix: string, isNap = false) => {
    const values = measurements(row);
    if (isNap) {
      values.lightMinutes = null;
      values.deepMinutes = null;
      values.remMinutes = null;
      values.awakeMinutes = null;
      values.awakeCount = null;
    }
    for (const key of stageDurationKeys) {
      if (isNap && key !== "totalSleepMinutes") continue;
      const value = values[key];
      const max = draft.detailMode === "summary" ? 1440 : 2_147_483_647;
      if ((key === "totalSleepMinutes" && (value === null || value <= 0)) || (value !== null && (!known(value) || value > max))) {
        errors[`${prefix}${key}`] = key === "totalSleepMinutes" ? `Enter a positive duration in HHMM format (e.g. 0730 for 7h 30m).` : `Enter a duration in HHMM format (e.g. 0115 for 1h 15m), or leave blank.`;
      }
    }
    if (!isNap) {
      const max = draft.detailMode === "summary" ? 1440 : 2_147_483_647;
      if (values.awakeMinutes !== null && (!known(values.awakeMinutes) || values.awakeMinutes > max)) {
        errors[`${prefix}awakeMinutes`] = `Enter a duration from 0 to ${max} minutes, or leave blank.`;
      }
      if (values.awakeCount !== null && !known(values.awakeCount)) errors[`${prefix}awakeCount`] = "Enter a whole number of awakenings from 0 to 2147483647, or leave blank.";
    }
    return { ...values, totalSleepMinutes: values.totalSleepMinutes ?? 0 };
  };
  const common = { sleepDate: draft.sleepDate, sleepScore: optionalInteger(draft.sleepScore), source: draft.source.trim(), notes: draft.notes.trim() || null };
  const input: SleepRecordInput = draft.detailMode === "summary" ? {
    ...common, ...readMeasurements(draft.summary, "", false),
    // Old summary clients cannot accidentally convert a concurrently changed record.
    ...(draft.originalMode === "sessions" || !draft.id ? { detailMode: "summary" as const } : {}),
  } : { ...common, detailMode: "sessions", sessions: draft.sessions.map((session, index) => {
    const prefix = `sessions.${index}.`;
    const isNap = session.sessionType === "nap";
    const times: { startedAt: string | null; endedAt: string | null } = { startedAt: null, endedAt: null };
    for (const key of ["startedAt", "endedAt"] as const) {
      try { times[key] = serializeLocalTime(session[key], key === "startedAt" ? session.originalStartedAt : session.originalEndedAt); }
      catch (error) { errors[`${prefix}${key}`] = (error as Error).message; }
    }
    if (times.startedAt && times.endedAt && new Date(times.endedAt) <= new Date(times.startedAt)) {
      errors[`${prefix}endedAt`] = "End must be after start. For overnight sleep, check the end date.";
    }
    return { ...readMeasurements(session, prefix, isNap), ...times, sessionType: session.sessionType, sortOrder: index, label: session.label.trim() || null, source: session.source.trim() || null };
  }) };
  const parsed = createSleepRecordSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.flatMap((issue) => issue.code === "invalid_union" ? issue.errors[draft.detailMode === "sessions" ? 1 : 0]! : [issue]);
    for (const issue of issues) errors[issue.path.join(".")] ??= issue.message;
  }
  return Object.keys(errors).length ? { errors } : { errors, input: parsed.success ? parsed.data : undefined };
};
