import { createSleepRecordSchema } from "../src/sleep-records/schemas.js";
import { aggregateSessions, stageCoverage } from "../src/sleep-records/service.js";
import type { SleepRecord, SleepRecordInput, SleepSession, SleepSessionInput } from "./api.js";
import { previousCalendarDay } from "./pap-date.js";

export type DetailMode = "summary" | "sessions";
export type DurationKey = "totalSleepMinutes" | "lightMinutes" | "deepMinutes" | "remMinutes";
export type DurationDraft = { hours: string; minutes: string };
export type MeasurementsDraft = Record<DurationKey, DurationDraft> & {
  awakeCount: string;
  awakeMinutes: string;
};
export type SessionDraft = MeasurementsDraft & {
  key: string; sessionType: SleepSessionInput["sessionType"]; label: string; source: string;
  startedAt: string; endedAt: string; originalStartedAt?: string | null; originalEndedAt?: string | null; detailsOpen: boolean;
};
export interface SleepDraft {
  id: string | null; originalMode: DetailMode; detailMode: DetailMode; sleepDate: string;
  summary: MeasurementsDraft; sessions: SessionDraft[]; sleepScore: string; source: string; notes: string;
}
export const durationKeys: DurationKey[] = ["totalSleepMinutes", "lightMinutes", "deepMinutes", "remMinutes"];
export const coverageLabels = { complete: "Complete stage data", partial: "Partial stage data", none: "No stage data" };
export const typeLabels = { "main-sleep": "Main sleep", nap: "Nap", other: "Other" };
export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
export const durationDraft = (value: number | null | undefined): DurationDraft => value == null
  ? { hours: "", minutes: "" } : { hours: String(Math.floor(value / 60)), minutes: String(value % 60) };
type Measurements = { [K in DurationKey]?: number | null } & { awakeCount?: number | null; awakeMinutes?: number | null };
export const measurementDraft = (values: Measurements = {}): MeasurementsDraft => ({
  totalSleepMinutes: durationDraft(values.totalSleepMinutes),
  lightMinutes: durationDraft(values.lightMinutes),
  deepMinutes: durationDraft(values.deepMinutes),
  remMinutes: durationDraft(values.remMinutes),
  awakeCount: values.awakeCount == null ? "" : String(values.awakeCount),
  awakeMinutes: values.awakeMinutes == null ? "" : String(values.awakeMinutes),
});
let nextKey = 0;
export const newSession = (sessionType: SessionDraft["sessionType"] = "main-sleep"): SessionDraft => ({
  ...measurementDraft(), key: `sleep-session-${++nextKey}`, sessionType, label: "", source: "", startedAt: "", endedAt: "", detailsOpen: sessionType === "main-sleep",
});
const pad = (value: number, length = 2) => String(value).padStart(length, "0");
export const localDateTime = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};
export const splitDateTime = (value: string): { date: string; time: string } => {
  if (!value) return { date: "", time: "" };
  const tIndex = value.indexOf("T");
  if (tIndex === -1) return { date: value, time: "" };
  return { date: value.slice(0, tIndex), time: value.slice(tIndex + 1, tIndex + 6) };
};
export const combineDateTime = (date: string, time: string): string => {
  const d = date.trim();
  const t = time.trim();
  if (!d && !t) return "";
  if (!t) return d;
  if (!d) return `T${t}`;
  return `${d}T${t}`;
};
export const durationFromTimes = (startedAt: string, endedAt: string): DurationDraft | null => {
  if (!startedAt || !endedAt || !startedAt.includes("T") || !endedAt.includes("T")) return null;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
  const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diffMinutes <= 0) return null;
  return {
    hours: String(Math.floor(diffMinutes / 60)),
    minutes: String(diffMinutes % 60),
  };
};
export const serializeLocalTime = (value: string, original?: string | null): string | null => {
  if (!value) return null;
  if (!value.includes("T") || !value.slice(0, value.indexOf("T")) || !value.slice(value.indexOf("T") + 1)) {
    throw new Error("Enter both date and time, or leave blank.");
  }
  const normalized = value.length === 16 ? `${value}:00.000` : value.length === 19 ? `${value}.000` : value.replace(/\.(\d{1,3})$/, (_, fraction: string) => `.${fraction.padEnd(3, "0")}`);
  // Preserve the original instant, including during a repeated daylight-saving hour.
  if (original && (value.length === 16 ? localDateTime(original).slice(0, 16) === value : localDateTime(original) === normalized)) return original;
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value) || Number.isNaN(date.valueOf()) || localDateTime(date) !== normalized) {
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
  if (firstEndedAt && firstEndedAt.includes("T")) {
    const toDate = firstEndedAt.slice(0, firstEndedAt.indexOf("T"));
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return toDate;
  }
  return draft.sleepDate;
};
export const syncNapDates = (sessions: SessionDraft[], toDate: string): SessionDraft[] => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return sessions;
  return sessions.map((session, index) => {
    if (index === 0 || session.sessionType !== "nap" || (!session.startedAt && !session.endedAt)) return session;
    const startTime = session.startedAt.includes("T") ? session.startedAt.slice(session.startedAt.indexOf("T")) : "";
    const endTime = session.endedAt.includes("T") ? session.endedAt.slice(session.endedAt.indexOf("T")) : "";
    return {
      ...session,
      startedAt: startTime ? `${toDate}${startTime}` : session.startedAt,
      endedAt: endTime ? `${toDate}${endTime}` : session.endedAt,
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
export const durationValue = ({ hours, minutes }: DurationDraft): number | null => {
  if (hours === "" && minutes === "") return null;
  const h = Number(hours || 0), m = Number(minutes || 0);
  return Number.isInteger(h) && h >= 0 && Number.isInteger(m) && m >= 0 && m <= 59 ? h * 60 + m : NaN;
};
const measurements = (draft: MeasurementsDraft) => ({
  totalSleepMinutes: durationValue(draft.totalSleepMinutes),
  awakeMinutes: optionalMinutes(draft.awakeMinutes),
  awakeCount: optionalInteger(draft.awakeCount),
  lightMinutes: durationValue(draft.lightMinutes),
  deepMinutes: durationValue(draft.deepMinutes),
  remMinutes: durationValue(draft.remMinutes),
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
  const readMeasurements = (row: MeasurementsDraft, prefix: string) => {
    const values = measurements(row);
    for (const key of durationKeys) {
      const value = values[key];
      const max = draft.detailMode === "summary" ? 1440 : 2_147_483_647;
      if ((key === "totalSleepMinutes" && (value === null || value <= 0)) || (value !== null && (!known(value) || value > max))) {
        errors[`${prefix}${key}`] = key === "totalSleepMinutes" ? `Enter a positive duration, at most ${max} minutes. Minutes must be 0–59.` : `Enter a duration from 0 to ${max} minutes, or leave blank. Minutes must be 0–59.`;
      }
    }
    const max = draft.detailMode === "summary" ? 1440 : 2_147_483_647;
    if (values.awakeMinutes !== null && (!known(values.awakeMinutes) || values.awakeMinutes > max)) {
      errors[`${prefix}awakeMinutes`] = `Enter a duration from 0 to ${max} minutes, or leave blank.`;
    }
    if (values.awakeCount !== null && !known(values.awakeCount)) errors[`${prefix}awakeCount`] = "Enter a whole number of awakenings from 0 to 2147483647, or leave blank.";
    return { ...values, totalSleepMinutes: values.totalSleepMinutes ?? 0 };
  };
  const common = { sleepDate: draft.sleepDate, sleepScore: optionalInteger(draft.sleepScore), source: draft.source.trim(), notes: draft.notes.trim() || null };
  const input: SleepRecordInput = draft.detailMode === "summary" ? {
    ...common, ...readMeasurements(draft.summary, ""),
    // Old summary clients cannot accidentally convert a concurrently changed record.
    ...(draft.originalMode === "sessions" || !draft.id ? { detailMode: "summary" as const } : {}),
  } : { ...common, detailMode: "sessions", sessions: draft.sessions.map((session, index) => {
    const prefix = `sessions.${index}.`;
    const times: { startedAt: string | null; endedAt: string | null } = { startedAt: null, endedAt: null };
    for (const key of ["startedAt", "endedAt"] as const) {
      try { times[key] = serializeLocalTime(session[key], key === "startedAt" ? session.originalStartedAt : session.originalEndedAt); }
      catch (error) { errors[`${prefix}${key}`] = (error as Error).message; }
    }
    if (times.startedAt && times.endedAt && new Date(times.endedAt) <= new Date(times.startedAt)) {
      errors[`${prefix}endedAt`] = "End must be after start. For overnight sleep, check the end date.";
    }
    return { ...readMeasurements(session, prefix), ...times, sessionType: session.sessionType, sortOrder: index, label: session.label.trim() || null, source: session.source.trim() || null };
  }) };
  const parsed = createSleepRecordSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.flatMap((issue) => issue.code === "invalid_union" ? issue.errors[draft.detailMode === "sessions" ? 1 : 0]! : [issue]);
    for (const issue of issues) errors[issue.path.join(".")] ??= issue.message;
  }
  return Object.keys(errors).length ? { errors } : { errors, input: parsed.success ? parsed.data : undefined };
};
