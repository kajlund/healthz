import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createSleepRecordSchema, type SleepRecordInput } from "../src/sleep-records/schemas.js";
import { stageCoverage, valuesFromSessionInput, valuesFromSleepInput } from "../src/sleep-records/service.js";
import type { SleepRecord } from "../web/api.js";

const stamp = "2026-09-16T08:00:00.000Z";
const summaryInput: SleepRecordInput = { sleepDate: "2026-09-16", totalSleepMinutes: 444, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 100, remMinutes: 104, source: "manual", sleepScore: 86 };
const stagedInput: SleepRecordInput = { sleepDate: "2026-09-16", detailMode: "sessions", source: "watch", sessions: [
  { sessionType: "main-sleep", label: "Night sleep", sortOrder: 0, totalSleepMinutes: 420, awakeMinutes: 18, awakeCount: 3, lightMinutes: 240, deepMinutes: 80, remMinutes: 100, startedAt: "2026-09-15T20:00:00Z", endedAt: "2026-09-16T04:00:00Z" },
] };
const makeRecord = (input: SleepRecordInput, id: string = randomUUID()): SleepRecord => {
  const parent = { ...valuesFromSleepInput(input), id, createdAt: stamp, updatedAt: stamp };
  const sessions = input.detailMode === "sessions" ? input.sessions.map((session) => ({ ...valuesFromSessionInput(session, id), id: randomUUID(), createdAt: stamp, updatedAt: stamp })) : [];
  return JSON.parse(JSON.stringify({ ...parent, sessions, stageCoverage: stageCoverage(input.detailMode === "sessions" ? sessions : [parent]) })) as SleepRecord;
};
const setup = async (page: Page, initial: SleepRecord[] = [makeRecord(summaryInput)], normalize?: (input: SleepRecordInput) => SleepRecordInput) => {
  let records = initial;
  const writes: SleepRecordInput[] = [];
  // Every API request is intercepted; the browser never touches real health data.
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    if (!new URL(req.url()).pathname.startsWith("/api/sleep-records")) return route.fulfill({ json: [] });
    if (req.method() === "GET") return route.fulfill({ json: records });
    if (req.method() === "DELETE") { records = records.filter(({ id }) => !req.url().endsWith(id)); return route.fulfill({ status: 204 }); }
    const parsed = createSleepRecordSchema.safeParse(req.postDataJSON());
    if (!parsed.success) return route.fulfill({ status: 400, json: { error: { message: "Invalid request", details: parsed.error.issues } } });
    writes.push(parsed.data);
    const saved = makeRecord(normalize ? normalize(parsed.data) : parsed.data, req.method() === "PUT" ? req.url().split("/").at(-1) : undefined);
    records = [...records.filter(({ id }) => id !== saved.id), saved];
    return route.fulfill({ status: req.method() === "POST" ? 201 : 200, json: saved });
  });
  await page.goto("/#/measurements/sleep");
  await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
  await expect(page.getByText("Loading sleep records…")).toHaveCount(0);
  return writes;
};
const card = (page: Page, index = 0) => page.locator(".sleep-session-card").nth(index);
const duration = async (scope: Page | Locator, name: string, hours: string, minutes: string) => {
  await scope.getByLabel(`${name} hours`, { exact: true }).fill(hours);
  await scope.getByLabel(`${name} minutes`, { exact: true }).fill(minutes);
};
const switchMode = async (page: Page, mode: "Individual sessions" | "Daily summary") => {
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.getByRole("button", { name: "Confirm mode change" }).click();
};

test("legacy summary remains editable: unknown, zero, and three awakenings are distinct", async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Daily summary", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Times awake", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Total time awake minutes", { exact: true })).toHaveValue("18");
  await page.getByLabel("Times awake", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  expect(writes[0]).toMatchObject({ awakeCount: 0, awakeMinutes: 18 });
  await expect(page.getByText("Times awake: 0", { exact: true })).toBeVisible();
  await page.getByLabel("Times awake", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  expect(writes[1]).toMatchObject({ awakeCount: 3, awakeMinutes: 18 });
});

test("new main sleep plus duration-only nap previews honest partial coverage and saves", async ({ page }) => {
  const writes = await setup(page, []);
  await switchMode(page, "Individual sessions");
  await expect(card(page).getByLabel("Session type")).toHaveValue("main-sleep");
  await duration(card(page), "Total sleep", "7", "0");
  await card(page).getByText("Sleep stages and Awake details", { exact: true }).click();
  await card(page).getByLabel("Times awake", { exact: true }).fill("3");
  await duration(card(page), "Total time awake", "0", "18");
  await duration(card(page), "Light sleep", "4", "0");
  await duration(card(page), "Deep sleep", "1", "20");
  await duration(card(page), "REM sleep", "1", "40");
  await expect(page.locator(".sleep-preview")).toContainText("Complete stage data");
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await expect(card(page, 1).getByLabel("Session type")).toHaveValue("nap");
  await duration(card(page, 1), "Total sleep", "", "40");
  await expect(page.locator(".sleep-preview")).toContainText("7 h 40 min");
  await expect(page.locator(".sleep-preview")).toContainText("Partial stage data");
  await expect(page.locator(".sleep-preview dd").filter({ hasText: "Not available for the complete day" })).toHaveCount(5);
  await page.getByRole("button", { name: "Add sleep record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  const input = writes[0];
  expect(input).not.toHaveProperty("totalSleepMinutes");
  if (input?.detailMode !== "sessions") throw new Error("Expected session request");
  expect(input.sessions[1]).toMatchObject({ sessionType: "nap", totalSleepMinutes: 40, awakeCount: null, lightMinutes: null, startedAt: null, endedAt: null });
  await expect(page.locator(".sleep-session-history")).not.toHaveAttribute("open");
  await page.getByText("View 2 sessions", { exact: true }).click();
  await expect(page.getByText("No stage details", { exact: true })).toBeVisible();
  await expect(page.getByText("Times awake: 3", { exact: false }).last()).toBeVisible();
});

test("two complete sessions aggregate correctly and reordering/removal preserve the right values", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)]);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await card(page, 1).getByLabel("Label (optional)").fill("Afternoon sleep");
  await duration(card(page, 1), "Total sleep", "0", "40");
  await card(page, 1).getByText("Sleep stages and Awake details", { exact: true }).click();
  await card(page, 1).getByLabel("Times awake", { exact: true }).fill("0");
  await duration(card(page, 1), "Total time awake", "0", "0");
  await duration(card(page, 1), "Light sleep", "0", "20");
  await duration(card(page, 1), "Deep sleep", "0", "10");
  await duration(card(page, 1), "REM sleep", "0", "10");
  await expect(page.locator(".sleep-preview")).toContainText("Complete stage data");
  await expect(page.locator(".sleep-preview")).toContainText("4 h 20 min");
  await page.getByRole("button", { name: "Move session 2 up", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Afternoon sleep");
  await expect(card(page, 1).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  const input = writes[0];
  if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
  expect(input.sessions.map(({ label, sortOrder }) => [label, sortOrder])).toEqual([["Afternoon sleep", 0], ["Night sleep", 1]]);
  await page.getByRole("button", { name: "Remove session 1", exact: true }).click();
  await expect(page.locator(".sleep-session-card")).toHaveCount(1);
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await expect(page.getByRole("button", { name: "Remove session 1", exact: true })).toBeDisabled();
});

test("both mode switches can be cancelled without saving or losing drafts", async ({ page }) => {
  const writes = await setup(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Individual sessions", exact: true }).click();
  await expect(page.getByText("Session totals will become authoritative", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Keep current mode" }).click();
  await expect(page.getByLabel("Total sleep hours", { exact: true })).toHaveValue("7");
  await expect(page.getByLabel("Total sleep minutes", { exact: true })).toHaveValue("24");
  await switchMode(page, "Individual sessions");
  await expect(card(page).getByLabel("Total sleep hours", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".sleep-field-error")).toContainText("positive duration");
  await duration(card(page), "Total sleep", "6", "30");
  await page.getByRole("button", { name: "Daily summary", exact: true }).click();
  await expect(page.getByText("All child sessions will be removed on Save.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Keep current mode" }).click();
  await expect(card(page).getByLabel("Total sleep hours", { exact: true })).toHaveValue("6");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel editing / new entry" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Total sleep minutes", { exact: true })).toHaveValue("24");
});

test("confirmed session-to-summary conversion prefills totals but waits for Save", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)]);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await switchMode(page, "Daily summary");
  await expect(page.getByText("Review these calculated totals", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Times awake", { exact: true })).toHaveValue("3");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".sleep-save-status")).toContainText("Sleep record saved");
  expect(writes[0]).toMatchObject({ detailMode: "summary", totalSleepMinutes: 420, awakeCount: 3 });
  expect(writes[0]).not.toHaveProperty("sessions");
  await expect(page.locator(".sleep-session-history")).toHaveCount(0);
});

test("cross-midnight local times preserve sleepDate and independent sleep duration", async ({ page }) => {
  const writes = await setup(page, []);
  await switchMode(page, "Individual sessions");
  await page.getByLabel("Sleep date *", { exact: true }).fill("2026-09-16");
  await duration(card(page), "Total sleep", "7", "0");
  await card(page).getByLabel("Start date/time (optional)").fill("2026-09-15T23:00");
  await card(page).getByLabel("End date/time (optional)").fill("2026-09-16T07:00");
  await page.getByRole("button", { name: "Add sleep record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  const input = writes[0];
  if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
  expect(input.sleepDate).toBe("2026-09-16");
  expect(input.sessions[0]).toMatchObject({ totalSleepMinutes: 420, startedAt: "2026-09-15T20:00:00.000Z", endedAt: "2026-09-16T04:00:00.000Z" });
});

test("invalid optional values open their disclosure and associate errors with fields", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)]);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await card(page).getByText("Sleep stages and Awake details", { exact: true }).click();
  await card(page).getByLabel("Times awake", { exact: true }).fill("-1");
  await card(page).getByText("Sleep stages and Awake details", { exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card(page).locator("details")).toHaveAttribute("open");
  const field = card(page).locator('[data-field="sessions.0.awakeCount"]');
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAttribute("aria-describedby", "sleep-error-sessions.0.awakeCount");
  await expect(field).toBeFocused();
  expect(writes).toHaveLength(0);
});

test("saved server response replaces the session preview and history", async ({ page }) => {
  await setup(page, [makeRecord(stagedInput)], (input) => input.detailMode === "sessions" ? { ...input, sessions: input.sessions.map((session) => ({ ...session, totalSleepMinutes: 500 })) } : input);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".sleep-preview")).toContainText("7 h 0 min");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Sleep record saved");
  await expect(page.locator(".sleep-preview")).toContainText("8 h 20 min");
  await expect(page.locator(".sleep-total")).toContainText("8 h 20 min");
  await expect(card(page).getByLabel("Total sleep hours", { exact: true })).toHaveValue("8");
});

for (const viewport of [{ name: "320px", width: 320, scale: 1 }, { name: "mobile", width: 390, scale: 1 }, { name: "desktop", width: 1440, scale: 1 }, { name: "200-percent-equivalent", width: 640, scale: 2 }]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: 900 }, deviceScaleFactor: viewport.scale });
    test("session fields and history fit without horizontal page scrolling", async ({ page }, testInfo) => {
      await setup(page, [makeRecord(stagedInput)]);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await card(page).getByText("Sleep stages and Awake details", { exact: true }).click();
      await page.getByText("View 1 session", { exact: true }).click();
      await expect(card(page).getByLabel("Times awake", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const widths = await page.locator('.sleep-page input[type="number"]').evaluateAll((inputs) => inputs.map((input) => input.getBoundingClientRect().width));
      expect(Math.min(...widths)).toBeGreaterThanOrEqual(50);
      await page.screenshot({ path: testInfo.outputPath(`sleep-${viewport.name}.png`), fullPage: true });
    });
  });
}
