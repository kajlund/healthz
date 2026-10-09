import { afterEach, describe, expect, it, vi } from "vitest";
import { combineDateTime, defaultMainSleepTimes, draftFromRecord, durationDraft, durationFromTimes, firstSessionToDate, localDateTime, measurementDraft, moveSession, newSession, newSleepDraft, previewSessions, removeSession, serializeLocalTime, splitDateTime, syncNapDates, validateDraft } from "../src/sleep-editor.js";
import { previousCalendarDay } from "../src/pap-date.js";
import type { SleepRecord } from "../src/api.js";

const record: SleepRecord = { id: "legacy", detailMode: "summary", sleepDate: "2026-09-15", totalSleepMinutes: 444, awakeMinutes: 18, awakeCount: null, lightMinutes: 240, deepMinutes: 100, remMinutes: 104, sleepScore: 86, source: "manual", notes: null, sessions: [], stageCoverage: "complete", createdAt: "2026-09-15T08:00:00Z", updatedAt: "2026-09-15T08:00:00Z" };
const main = () => ({ ...newSession(), ...measurementDraft({ totalSleepMinutes: 420, awakeCount: 3, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 80, remMinutes: 100 }) });
afterEach(() => vi.unstubAllEnvs());

describe("Sleep editor drafts", () => {
  it("keeps existing summaries editable and preserves unknown versus zero awakenings", () => {
    const draft = draftFromRecord(record);
    expect(draft.detailMode).toBe("summary");
    expect(draft.summary.awakeCount).toBe("");
    expect(validateDraft(draft).input).toMatchObject({ totalSleepMinutes: 444, awakeMinutes: 18, awakeCount: null });
    draft.summary.awakeCount = "0";
    expect(validateDraft(draft).input).toMatchObject({ awakeCount: 0 });
    draft.summary.awakeCount = "3";
    expect(validateDraft(draft).input).toMatchObject({ awakeMinutes: 18, awakeCount: 3 });
    expect(record.awakeCount).toBeNull();
  });
  it("starts with one blank expanded Main sleep session and preserves summaries", () => {
    const draft = newSleepDraft();
    expect(draft.detailMode).toBe("sessions");
    expect(draft.sessions).toHaveLength(1);
    expect(draft.sessions[0]).toMatchObject({ sessionType: "main-sleep", detailsOpen: true, totalSleepMinutes: durationDraft(null) });
    expect(draftFromRecord(record).sessions).toEqual([]);
    expect(draftFromRecord(record).detailMode).toBe("summary");
    expect(validateDraft(draft).errors["sessions.0.totalSleepMinutes"]).toBeTruthy();
  });
  it("defaults From to Sleep date - 1 day and To to Sleep date when adding sleep entries", () => {
    const draft = newSleepDraft();
    const today = draft.sleepDate;
    const yesterday = previousCalendarDay(today);
    expect(draft.sessions[0]!.startedAt).toBe(`${yesterday}T23:00`);
    expect(draft.sessions[0]!.endedAt).toBe(`${today}T07:00`);

    const customDateDraft = newSleepDraft("2026-08-15");
    expect(customDateDraft.sessions[0]!.startedAt).toBe("2026-08-14T23:00");
    expect(customDateDraft.sessions[0]!.endedAt).toBe("2026-08-15T07:00");
  });
  it("determines the To date of the first session with a fallback to sleepDate", () => {
    const draft = newSleepDraft("2026-09-15");
    expect(firstSessionToDate(draft)).toBe("2026-09-15");
    draft.sessions[0]!.endedAt = "2026-09-16T08:00";
    expect(firstSessionToDate(draft)).toBe("2026-09-16");
    draft.sessions[0]!.endedAt = "";
    expect(firstSessionToDate(draft)).toBe("2026-09-15");
    expect(defaultMainSleepTimes("2026-09-16")).toEqual({
      startedAt: "2026-09-15T23:00",
      endedAt: "2026-09-16T07:00",
    });
  });
  it("syncs existing nap dates while preserving times and leaving blank naps untouched", () => {
    const mainSession = { ...newSession("main-sleep"), startedAt: "2026-09-14T23:00", endedAt: "2026-09-15T07:00" };
    const timedNap = { ...newSession("nap"), startedAt: "2026-09-15T13:00", endedAt: "2026-09-15T14:00" };
    const dateOnlyNap = { ...newSession("nap"), startedAt: "2026-09-15", endedAt: "2026-09-15" };
    const blankNap = { ...newSession("nap"), startedAt: "", endedAt: "" };
    const synced = syncNapDates([mainSession, timedNap, dateOnlyNap, blankNap], "2026-09-16");
    expect(synced[0]!.startedAt).toBe("2026-09-14T23:00");
    expect(synced[1]!.startedAt).toBe("2026-09-16T13:00");
    expect(synced[1]!.endedAt).toBe("2026-09-16T14:00");
    expect(synced[2]!.startedAt).toBe("2026-09-16");
    expect(synced[2]!.endedAt).toBe("2026-09-16");
    expect(synced[3]!.startedAt).toBe("");
    expect(synced[3]!.endedAt).toBe("");
  });
  it("serializes main sleep plus a duration-only nap without parent aggregates or child IDs", () => {
    const draft = newSleepDraft();
    draft.sessions = [main(), { ...newSession("nap"), totalSleepMinutes: durationDraft(40) }];
    const { input, errors } = validateDraft(draft);
    expect(errors).toEqual({});
    expect(input).not.toHaveProperty("totalSleepMinutes");
    if (input?.detailMode !== "sessions") throw new Error("Expected sessions input");
    expect(input.sessions.map(({ sortOrder }) => sortOrder)).toEqual([0, 1]);
    expect(input.sessions[1]).toMatchObject({ sessionType: "nap", totalSleepMinutes: 40, startedAt: null, endedAt: null, awakeCount: null, awakeMinutes: null, lightMinutes: null, deepMinutes: null, remMinutes: null });
    expect(input.sessions[0]).not.toHaveProperty("id");
  });
  it("shows conservative partial and complete daily previews", () => {
    const partial = previewSessions([main(), { ...newSession("nap"), totalSleepMinutes: durationDraft(40) }]);
    expect(partial).toEqual({ totalSleepMinutes: 460, awakeCount: null, awakeMinutes: null, lightMinutes: null, deepMinutes: null, remMinutes: null, stageCoverage: "partial" });
    expect(previewSessions([main(), main()])).toMatchObject({ totalSleepMinutes: 840, awakeCount: 6, awakeMinutes: 36, lightMinutes: 480, deepMinutes: 160, remMinutes: 200, stageCoverage: "complete" });
  });
  it("keeps unknown total empty and does not treat zero stages as missing", () => {
    expect(previewSessions([newSession()]).totalSleepMinutes).toBeNull();
    expect(previewSessions([{ ...newSession(), ...measurementDraft({ totalSleepMinutes: 30, awakeCount: 0, lightMinutes: 0, deepMinutes: 0, remMinutes: 0 }) }])).toMatchObject({ awakeCount: 0, stageCoverage: "complete", awakeMinutes: null });
  });
  it("moves whole sessions and removes only the selected one while retaining at least one", () => {
    const first = main(), second = newSession("nap");
    expect(moveSession([first, second], 1, -1)).toEqual([second, first]);
    expect(removeSession([first, second], first.key)).toEqual([second]);
    expect(removeSession([first], first.key)).toEqual([first]);
  });
  it("reports field-specific errors for optional details and cross-midnight end ordering", () => {
    const draft = newSleepDraft();
    draft.sessions = [{ ...main(), awakeCount: "-1", lightMinutes: { hours: "0", minutes: "60" }, startedAt: "2026-09-15T23:00", endedAt: "2026-09-15T06:00" }];
    expect(validateDraft(draft).errors["sessions.0.awakeCount"]).toBeTruthy();
    expect(validateDraft(draft).errors["sessions.0.lightMinutes"]).toBeTruthy();
    expect(validateDraft(draft).errors["sessions.0.endedAt"]).toBeTruthy();
  });
  it("serializes local cross-midnight times as instants without changing sleepDate or duration", () => {
    vi.stubEnv("TZ", "Europe/Helsinki");
    const draft = newSleepDraft();
    draft.sleepDate = "2026-09-16";
    draft.sessions = [{ ...main(), startedAt: "2026-09-15T23:00", endedAt: "2026-09-16T07:00" }];
    const { input } = validateDraft(draft);
    if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
    expect(input.sleepDate).toBe("2026-09-16");
    expect(input.sessions[0]).toMatchObject({ startedAt: "2026-09-15T20:00:00.000Z", endedAt: "2026-09-16T04:00:00.000Z", totalSleepMinutes: 420 });
    expect(localDateTime("2026-09-15T20:00:00Z")).toBe("2026-09-15T23:00:00.000");
  });
  it("preserves an unchanged repeated-hour instant and rejects nonexistent local times", () => {
    vi.stubEnv("TZ", "Europe/Helsinki");
    const original = "2026-10-25T01:30:00.000Z";
    expect(serializeLocalTime(localDateTime(original), original)).toBe(original);
    const precise = "2026-09-15T20:00:12.100Z";
    expect(serializeLocalTime(localDateTime(precise).slice(0, 16), precise)).toBe(precise);
    expect(serializeLocalTime("2026-09-15T23:00:12.1")).toBe(precise);
    expect(() => serializeLocalTime("2026-03-29T03:30")).toThrow("clock change");
    expect(serializeLocalTime("")).toBeNull();
  });
  it("enters awakeMinutes in minutes only and validates correctly", () => {
    const draft = newSleepDraft();
    expect(draft.summary.awakeMinutes).toBe("");
    expect(draft.sessions[0]!.awakeMinutes).toBe("");

    // Number of minutes in summary mode
    draft.detailMode = "summary";
    draft.summary.totalSleepMinutes = { hours: "7", minutes: "0" };
    draft.summary.awakeMinutes = "45";
    expect(validateDraft(draft).input).toMatchObject({ totalSleepMinutes: 420, awakeMinutes: 45 });

    // Negative minutes rejected
    draft.summary.awakeMinutes = "-5";
    expect(validateDraft(draft).errors["awakeMinutes"]).toBeTruthy();

    // Minutes exceeding 24 hours in summary mode rejected
    draft.summary.awakeMinutes = "1441";
    expect(validateDraft(draft).errors["awakeMinutes"]).toBeTruthy();

    // In session mode
    draft.detailMode = "sessions";
    draft.sessions[0]!.totalSleepMinutes = { hours: "7", minutes: "0" };
    draft.sessions[0]!.awakeMinutes = "30";
    const res = validateDraft(draft);
    expect(res.errors).toEqual({});
    if (res.input?.detailMode !== "sessions") throw new Error("Expected sessions");
    expect(res.input.sessions[0]).toMatchObject({ awakeMinutes: 30 });
  });
  it("splits and combines datetime-local strings correctly", () => {
    expect(splitDateTime("2026-10-04T13:00")).toEqual({ date: "2026-10-04", time: "13:00" });
    expect(splitDateTime("2026-10-04")).toEqual({ date: "2026-10-04", time: "" });
    expect(splitDateTime("T13:00")).toEqual({ date: "", time: "13:00" });
    expect(splitDateTime("")).toEqual({ date: "", time: "" });

    expect(combineDateTime("2026-10-04", "13:00")).toBe("2026-10-04T13:00");
    expect(combineDateTime("2026-10-04", "")).toBe("2026-10-04");
    expect(combineDateTime("", "13:00")).toBe("T13:00");
    expect(combineDateTime("", "")).toBe("");
  });
  it("calculates duration from start and end times automatically", () => {
    expect(durationFromTimes("2026-10-04T13:00", "2026-10-04T14:30")).toEqual({ hours: "1", minutes: "30" });
    expect(durationFromTimes("2026-10-03T23:00", "2026-10-04T07:00")).toEqual({ hours: "8", minutes: "0" });
    expect(durationFromTimes("2026-10-04T14:00", "2026-10-04T13:00")).toBeNull();
    expect(durationFromTimes("2026-10-04T13:00", "2026-10-04T13:00")).toBeNull();
    expect(durationFromTimes("2026-10-04", "2026-10-04T14:00")).toBeNull();
    expect(durationFromTimes("", "2026-10-04T14:00")).toBeNull();
  });
  it("rejects incomplete datetime with only date or only time", () => {
    expect(() => serializeLocalTime("2026-10-04")).toThrow("Enter both date and time, or leave blank.");
    expect(() => serializeLocalTime("T13:00")).toThrow("Enter both date and time, or leave blank.");
  });
});
