import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createSleepRecordSchema, type SleepRecordInput } from "../../api/src/sleep-records/schemas.js";
import { stageCoverage, valuesFromSessionInput, valuesFromSleepInput } from "../../api/src/sleep-records/service.js";
import type { SleepRecord } from "../src/api.js";

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
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const req = route.request();
    if (!new URL(req.url()).pathname.startsWith("/api/sleep-records")) return route.fulfill({ json: [] });
    if (req.method() === "GET") {
      const id = new URL(req.url()).pathname.slice("/api/sleep-records".length + 1);
      if (!id) return route.fulfill({ json: records });
      const record = records.find((record) => record.id === id);
      return record ? route.fulfill({ json: record }) : route.fulfill({ status: 404, json: { error: { message: "Sleep record not found" } } });
    }
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
const openNew = async (page: Page) => {
  await page.getByRole("link", { name: "Add sleep", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add sleep", exact: true })).toBeVisible();
};
const openEdit = async (page: Page) => {
  await page.getByRole("button", { name: /^Actions for sleep on/ }).first().click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
};
const save = async (page: Page) => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
};
const stages = async (scope: Locator) => {
  await duration(scope, "Deep", "1", "20");
  await duration(scope, "Light", "4", "0");
  await duration(scope, "REM", "1", "40");
};

test("direct new URL starts one blank expanded Main sleep in source field order", async ({ page }) => {
  await setup(page, []);
  await page.goto("/#/measurements/sleep/new");
  await expect(page.getByRole("heading", { name: "Add sleep", exact: true })).toBeVisible();
  await expect(page.locator(".sleep-session-card")).toHaveCount(1);
  await expect(card(page).getByLabel("Session type")).toHaveValue("main-sleep");
  await expect(card(page).getByLabel("Total sleep hours", { exact: true })).toHaveValue("");
  await expect(card(page).getByLabel("Times awake", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daily summary" })).toHaveCount(0);
  const order = await card(page).locator("input[data-field]").evaluateAll((inputs) => [...new Set(inputs.map((input) => (input as HTMLElement).dataset.field?.split(".").at(-1)))]);
  expect(order).toEqual(["startedAt", "endedAt", "totalSleepMinutes", "deepMinutes", "lightMinutes", "remMinutes", "awakeCount", "awakeMinutes", "label", "source"]);
  const daily = page.locator(".sleep-daily-fields input");
  await expect(daily.nth(0)).toHaveAttribute("type", "date");
  await expect(daily.nth(1)).toHaveAttribute("readonly");
  await expect(daily.nth(2)).toHaveAttribute("data-field", "sleepScore");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/#\/measurements\/sleep$/);
});

test("main sleep plus a duration-only 1 h 7 min nap saves unknown stages and a single daily total", async ({ page }) => {
  const writes = await setup(page, []);
  await page.goto("/#/measurements/sleep?month=2026-09");
  await openNew(page);
  await duration(card(page), "Total sleep", "7", "0");
  await stages(card(page));
  await card(page).getByLabel("Times awake", { exact: true }).fill("0");
  await expect(page.locator(".sleep-preview")).toContainText("Complete stage data");
  await page.getByRole("button", { name: "Add another session" }).click();
  await expect(card(page, 1).getByLabel("Session type")).toHaveValue("nap");
  await expect(card(page, 1).locator("details")).not.toHaveAttribute("open");
  await duration(card(page, 1), "Total sleep", "1", "7");
  await expect(page.locator(".sleep-daily-total")).toHaveValue("8 h 7 min");
  await expect(page.locator(".sleep-preview")).toContainText("Partial stage data");
  await expect(page.locator(".sleep-preview")).toContainText("2 sessions");
  await expect(page.locator(".sleep-preview")).toContainText("Some sessions do not include sleep-stage details.");
  await save(page);
  await expect(page).toHaveURL(/#\/measurements\/sleep\?month=2026-09$/);
  const input = writes[0];
  expect(input).not.toHaveProperty("totalSleepMinutes");
  if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
  expect(input.sessions[0]?.awakeCount).toBe(0);
  expect(input.sessions[1]).toMatchObject({ sessionType: "nap", totalSleepMinutes: 67, awakeCount: null, awakeMinutes: null, deepMinutes: null, lightMinutes: null, remMinutes: null, startedAt: null, endedAt: null });
  await expect(page.locator(".sleep-total")).toContainText("8 h 7 min");
  await expect(page.locator(".stage-cell")).toContainText("Partial stage data");
  await page.getByText("View 2 sessions", { exact: true }).click();
  await expect(page.getByText("No stage details", { exact: true })).toBeVisible();
});

test("existing summary edits preserve format, null and zero, and Cancel makes no write", async ({ page }) => {
  const record = makeRecord(summaryInput);
  const writes = await setup(page, [record]);
  await openEdit(page);
  await expect(page.locator(".sleep-session-card")).toHaveCount(0);
  await expect(page.getByLabel("Total sleep minutes", { exact: true })).toHaveValue("24");
  await expect(page.getByLabel("Times awake", { exact: true })).toHaveValue("");
  await page.getByLabel("Times awake", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await openEdit(page);
  await expect(page.getByLabel("Times awake", { exact: true })).toHaveValue("");
  expect(writes).toHaveLength(0);
  await save(page);
  expect(writes[0]).toMatchObject({ ...summaryInput, awakeCount: null });
  expect(writes[0]).not.toHaveProperty("sessions");
  await openEdit(page);
  await page.getByLabel("Times awake", { exact: true }).fill("0");
  await save(page);
  expect(writes[1]).toMatchObject({ awakeCount: 0, awakeMinutes: 18, totalSleepMinutes: 444 });
});

test("edit loads by ID on direct navigation and refresh; Back and Forward follow routes", async ({ page }) => {
  const record = makeRecord(stagedInput);
  await setup(page, [makeRecord(summaryInput), record]);
  await page.goto(`/#/measurements/sleep/${record.id}/edit`);
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await page.reload();
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
  await page.goBack();
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
});

test("list query state survives refresh, Cancel and Save; unrelated return URLs fall back safely", async ({ page }) => {
  await setup(page);
  const list = "#/measurements/sleep?month=2026-09&source=watch%20%26%20manual&page=2";
  await page.goto(`/${list}`);
  await openNew(page);
  await page.reload();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.poll(() => new URL(page.url()).hash).toBe(list);
  await openEdit(page);
  await save(page);
  await expect.poll(() => new URL(page.url()).hash).toBe(list);
  await page.goto("/#/measurements/sleep/new?returnTo=https%3A%2F%2Fexample.com");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/#\/measurements\/sleep$/);
});

test("invalid, missing and nonexistent IDs show an error with a way back", async ({ page }) => {
  await setup(page);
  for (const path of ["bad/edit", "edit", `${randomUUID()}/edit`]) {
    await page.goto(`/#/measurements/sleep/${path}`);
    await expect(page.getByRole("alert")).toContainText(path === "edit" || path === "bad/edit" ? "Invalid sleep record ID" : "Sleep record not found");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to Sleep" }).click();
    await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
  }
});

test("details survive disclosure toggling, complete sessions remain complete, reorder and removal are guarded", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)]);
  await openEdit(page);
  await page.getByRole("button", { name: "Add another session" }).click();
  await duration(card(page, 1), "Total sleep", "1", "7");
  await card(page, 1).getByText("Add details", { exact: true }).click();
  await stages(card(page, 1)); // Stage sums need not equal the reported duration.
  await card(page, 1).getByLabel("Label (optional)").fill("Afternoon sleep");
  await card(page, 1).getByLabel("Times awake", { exact: true }).fill("0");
  await card(page, 1).getByText("Add details", { exact: true }).click();
  await expect(card(page, 1).locator("details")).not.toHaveAttribute("open");
  await card(page, 1).getByText("Add details", { exact: true }).click();
  await expect(card(page, 1).getByLabel("Times awake", { exact: true })).toHaveValue("0");
  await expect(page.locator(".sleep-preview")).toContainText("Complete stage data");
  await page.getByRole("button", { name: "Move session 2 up", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Afternoon sleep");
  await save(page);
  const input = writes[0];
  if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
  expect(input.sessions.map(({ label, sortOrder }) => [label, sortOrder])).toEqual([["Afternoon sleep", 0], ["Night sleep", 1]]);
  await openEdit(page);
  await expect(card(page).locator("details")).toHaveAttribute("open");
  await expect(card(page).getByLabel("Times awake", { exact: true })).toHaveValue("0");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Remove session 1", exact: true }).click();
  await expect(page.locator(".sleep-session-card")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove session 1", exact: true }).click();
  await expect(page.locator(".sleep-session-card")).toHaveCount(1);
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  await expect(page.getByRole("button", { name: "Remove session 1", exact: true })).toBeDisabled();
});

test("cross-midnight local times serialize independently of sleep duration", async ({ page }) => {
  const writes = await setup(page, []);
  await openNew(page);
  await page.getByLabel("Sleep date *", { exact: true }).fill("2026-09-16");
  await duration(card(page), "Total sleep", "7", "0");
  await card(page).getByLabel("From", { exact: true }).fill("2026-09-15T23:00");
  await card(page).getByLabel("To", { exact: true }).fill("2026-09-16T07:00");
  await save(page);
  const input = writes[0];
  if (input?.detailMode !== "sessions") throw new Error("Expected sessions");
  expect(input.sleepDate).toBe("2026-09-16");
  expect(input.sessions[0]).toMatchObject({ totalSleepMinutes: 420, startedAt: "2026-09-15T20:00:00.000Z", endedAt: "2026-09-16T04:00:00.000Z", awakeCount: null });
});

test("validation reveals collapsed details, preserves values and associates errors", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)]);
  await openEdit(page);
  await page.getByRole("button", { name: "Add another session" }).click();
  await duration(card(page, 1), "Total sleep", "1", "7");
  await card(page, 1).getByText("Add details", { exact: true }).click();
  await card(page, 1).getByLabel("Times awake", { exact: true }).fill("-1");
  await card(page, 1).getByLabel("From", { exact: true }).fill("2026-09-16T16:00");
  await card(page, 1).getByLabel("To", { exact: true }).fill("2026-09-16T15:00");
  await card(page, 1).getByText("Add details", { exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card(page, 1).locator("details")).toHaveAttribute("open");
  await expect(card(page, 1).getByLabel("To", { exact: true })).toBeFocused();
  await expect(card(page, 1).getByLabel("Times awake", { exact: true })).toHaveAttribute("aria-describedby", "sleep-error-sessions.1.awakeCount");
  await expect(card(page, 1).getByLabel("Times awake", { exact: true })).toHaveValue("-1");
  await expect(card(page, 1).getByLabel("Total sleep minutes", { exact: true })).toHaveValue("7");
  expect(writes).toHaveLength(0);
});

test("API errors keep drafts, repeated Save is guarded, and server values reach the list", async ({ page }) => {
  const writes = await setup(page, [makeRecord(stagedInput)], (input) => input.detailMode === "sessions" ? { ...input, sessions: input.sessions.map((session) => ({ ...session, totalSleepMinutes: 500 })) } : input);
  await openEdit(page);
  await page.route("**/api/sleep-records/*", async (route) => route.request().method() === "PUT" ? route.fulfill({ status: 409, json: { error: { message: "A sleep record already exists for this date" } } }) : route.fallback(), { times: 1 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(card(page).getByLabel("Label (optional)")).toHaveValue("Night sleep");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/sleep-records/*", async (route) => { await gate; await route.fallback(); }, { times: 1 });
  await page.locator("form").evaluate((form) => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("heading", { name: "Your sleep records" })).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(page.locator(".sleep-total")).toContainText("8 h 20 min");
  await openEdit(page);
  await expect(card(page).getByLabel("Total sleep hours", { exact: true })).toHaveValue("8");
});

test("record actions support keyboard navigation, dismissal and only one open menu", async ({ page }) => {
  const record = makeRecord(summaryInput);
  await setup(page, [record, makeRecord({ ...summaryInput, sleepDate: "2026-09-15" })]);
  const triggers = page.getByRole("button", { name: /^Actions for sleep on/ });
  const first = triggers.first();
  await expect(first).toHaveAccessibleName(/Actions for sleep on .*16.*2026/);
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menu")).toHaveAccessibleName(/Actions for sleep on .*16.*2026/);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await first.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await first.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.getByRole("menu")).toBeVisible();
  await triggers.nth(1).click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("heading", { name: "Your sleep records" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await first.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(triggers.nth(1)).toBeFocused();
  await first.click();
  await expect(page.getByRole("menuitem", { name: /Duplicate|Copy|Convert/i })).toHaveCount(0);
  await expect(page).toHaveURL(/#\/measurements\/sleep$/);
  await page.getByRole("menuitem", { name: "Edit" }).focus();
  await page.keyboard.press("Space");
  await expect.poll(() => new URL(page.url()).hash.split("?")[0]).toBe(`#/measurements/sleep/${record.id}/edit`);
  await expect(page.getByRole("heading", { name: "Edit sleep", exact: true })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("Delete confirms, cancellation keeps data, and successful deletion preserves the list context and focus", async ({ page }) => {
  await setup(page);
  const list = "#/measurements/sleep?month=2026-09&page=2";
  await page.goto(`/${list}`);
  let deletions = 0;
  page.on("request", (request) => { if (request.method() === "DELETE") deletions++; });
  const trigger = page.getByRole("button", { name: /^Actions for sleep on/ });
  await trigger.click();
  page.once("dialog", async (dialog) => { expect(dialog.type()).toBe("confirm"); expect(dialog.message()).toContain("2026"); await dialog.dismiss(); });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".measurement-row")).toHaveCount(1);
  expect(deletions).toBe(0);
  await trigger.click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.locator(".measurement-row")).toHaveCount(0);
  await expect(page.getByText("Start your sleep history")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add sleep", exact: true })).toBeFocused();
  expect(deletions).toBe(1);
  await expect.poll(() => new URL(page.url()).hash).toBe(list);
});

test("failed Delete retains the record, displays the API error and restores focus", async ({ page }) => {
  await setup(page);
  await page.route("**/api/sleep-records/*", (route) => route.request().method() === "DELETE"
    ? route.fulfill({ status: 500, json: { error: { message: "Unable to delete sleep record. Try again." } } }) : route.fallback());
  const trigger = page.getByRole("button", { name: /^Actions for sleep on/ });
  await trigger.click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to delete sleep record");
  await expect(page.locator(".measurement-row")).toHaveCount(1);
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeEnabled();
  await expect(page).toHaveURL(/#\/measurements\/sleep$/);
});

for (const viewport of [
  { name: "320x568", width: 320, height: 568, scale: 1 },
  { name: "375x667", width: 375, height: 667, scale: 1 },
  { name: "768x1024", width: 768, height: 1024, scale: 1 },
  { name: "1280x720", width: 1280, height: 720, scale: 1 },
  { name: "1440x900", width: 1440, height: 900, scale: 1 },
  { name: "200-percent-equivalent", width: 640, height: 360, scale: 2 },
]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.scale });
    test("editor and list fit without horizontal scrolling", async ({ page }, testInfo) => {
      await setup(page, [makeRecord({ ...stagedInput, source: "LongSource".repeat(20) })]);
      await openEdit(page);
      await page.getByRole("button", { name: "Add another session" }).click();
      await duration(card(page, 1), "Total sleep", "1", "7");
      await expect(card(page).getByLabel("Times awake", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const widths = await page.locator('.sleep-page input[type="number"]').evaluateAll((inputs) => inputs.filter((input) => input.getBoundingClientRect().width > 0).map((input) => input.getBoundingClientRect().width));
      expect(Math.min(...widths)).toBeGreaterThanOrEqual(50);
      await page.screenshot({ path: testInfo.outputPath(`sleep-${viewport.name}.png`), fullPage: true });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByText("View 1 session", { exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const trigger = page.getByRole("button", { name: /^Actions for sleep on/ });
      await trigger.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      const bounds = await menu.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`sleep-actions-${viewport.name}.png`) });
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    });
  });
}
