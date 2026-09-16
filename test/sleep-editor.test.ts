import { afterEach, describe, expect, it, vi } from "vitest";
import { changeMode, draftFromRecord, durationDraft, localDateTime, measurementDraft, moveSession, newSession, newSleepDraft, previewSessions, removeSession, serializeLocalTime, validateDraft } from "../web/sleep-editor.js";
import type { SleepRecord } from "../web/api.js";

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
  it("starts in summary mode and never fabricates a session from summary measurements", () => {
    expect(newSleepDraft().detailMode).toBe("summary");
    const draft = changeMode(draftFromRecord(record), "sessions");
    expect(draft.sessions).toHaveLength(1);
    expect(draft.sessions[0]!.sessionType).toBe("main-sleep");
    expect(draft.sessions[0]!.totalSleepMinutes).toEqual(durationDraft(null));
    expect(validateDraft(draft).errors["sessions.0.totalSleepMinutes"]).toBeTruthy();
  });
  it("serializes main sleep plus a duration-only nap without parent aggregates or child IDs", () => {
    const draft = changeMode(newSleepDraft(), "sessions");
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
  it("prefills only calculated summary values and requires review without mutating the draft", () => {
    const draft = changeMode(newSleepDraft(), "sessions");
    draft.sessions = [main(), { ...newSession("nap"), totalSleepMinutes: durationDraft(40) }];
    const next = changeMode(draft, "summary");
    expect(next.reviewSummary).toBe(true);
    expect(next.summary.totalSleepMinutes).toEqual(durationDraft(460));
    expect(next.summary.awakeCount).toBe("");
    expect(next.summary.lightMinutes).toEqual(durationDraft(null));
    expect(draft.detailMode).toBe("sessions");
  });
  it("reports field-specific errors for optional details and cross-midnight end ordering", () => {
    const draft = changeMode(newSleepDraft(), "sessions");
    draft.sessions = [{ ...main(), awakeCount: "-1", lightMinutes: { hours: "0", minutes: "60" }, startedAt: "2026-09-15T23:00", endedAt: "2026-09-15T06:00" }];
    expect(validateDraft(draft).errors["sessions.0.awakeCount"]).toBeTruthy();
    expect(validateDraft(draft).errors["sessions.0.lightMinutes"]).toBeTruthy();
    expect(validateDraft(draft).errors["sessions.0.endedAt"]).toBeTruthy();
  });
  it("serializes local cross-midnight times as instants without changing sleepDate or duration", () => {
    vi.stubEnv("TZ", "Europe/Helsinki");
    const draft = changeMode(newSleepDraft(), "sessions");
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
});
