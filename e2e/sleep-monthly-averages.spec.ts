import { expect, test, type Page } from "@playwright/test";
import { calculateMonthlyReports, monthsBetween } from "../src/reports/calculations.js";
import type { MonthlySleepAverage } from "../web/api.js";
import type { ReportData } from "../src/reports/types.js";

const fields = ["Average total sleep", "Average deep sleep", "Average light sleep", "Average REM sleep"];
const entered = { id: "00000000-0000-4000-8000-000000000001", year: 2025, month: 1, averageTotalSleepMinutes: 480, averageDeepMinutes: 100, averageLightMinutes: 270, averageRemMinutes: 110, source: "manual", notes: null, createdAt: "2026-09-28T00:00:00Z", updatedAt: "2026-09-28T00:00:00Z" };
const daily: ReportData = { weights: [], bloodPressures: [], papRecords: [], sleepRecords: [{ sleepDate: "2025-01-01", totalSleepMinutes: 400, deepMinutes: 80, lightMinutes: 200, remMinutes: 120, awakeMinutes: 20, awakeCount: 2, sleepScore: 80 }, { sleepDate: "2026-01-01", totalSleepMinutes: 420, deepMinutes: 80, lightMinutes: 220, remMinutes: 120, awakeMinutes: null, sleepScore: null }] };
const setup = async (page: Page, initial: MonthlySleepAverage[] = []) => {
  let records = structuredClone(initial);
  let conflict = false;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.startsWith("/api/sleep-monthly-averages")) {
      if (method === "GET") return route.fulfill({ json: records });
      if (method === "POST") {
        const body = route.request().postDataJSON();
        if (conflict || records.some(r => r.year === body.year && r.month === body.month)) return route.fulfill({ status: 409, json: { error: { code: "CONFLICT", message: "A monthly sleep average already exists for this month." } } });
        records.push({ ...entered, ...body }); return route.fulfill({ status: 201, json: records.at(-1) });
      }
      const parts = path.split("/"); const year = Number(parts[3]), month = Number(parts[4]);
      if (method === "PUT") { records = records.map(r => r.year === year && r.month === month ? { ...r, ...route.request().postDataJSON() } : r); return route.fulfill({ json: records.find(r => r.year === year && r.month === month) }); }
      if (method === "DELETE") { records = records.filter(r => r.year !== year || r.month !== month); return route.fulfill({ status: 204 }); }
    }
    const source = { ...daily, sleepMonthlyAverages: records };
    if (path.endsWith("/reports/monthly")) {
      const from = url.searchParams.get("from")!, to = url.searchParams.get("to")!;
      return route.fulfill({ json: { meta: { from, to }, months: calculateMonthlyReports(monthsBetween(from, to), source) } });
    }
    if (path.endsWith("/reports/year-over-year")) {
      const years = url.searchParams.get("years")!.split(",").map(Number);
      return route.fulfill({ json: { meta: { years }, series: years.map(year => ({ year, months: calculateMonthlyReports(monthsBetween(`${year}-01`, `${year}-12`), source) })) } });
    }
    return route.fulfill({ json: [] });
  });
  return { records: () => records, conflict: () => { conflict = true; } };
};
const fill = async (page: Page) => {
  await page.getByLabel("Month", { exact: true }).fill("2025-01");
  for (const [index, label] of fields.entries()) {
    await page.getByLabel(`${label} hours`, { exact: true }).fill(String([8, 1, 4, 0][index]));
    await page.getByLabel(`${label} minutes`, { exact: true }).fill(String([0, 40, 30, 0][index]));
  }
};
test("create, required fields, zero, duplicate, edit and confirmed deletion", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/#/measurements/sleep");
  await page.getByRole("link", { name: "Monthly sleep averages" }).click();
  await expect(page.getByText("Enter monthly nightly averages, not monthly totals.")).toBeVisible();
  await page.getByLabel("Month", { exact: true }).fill("2025-01");
  await page.getByRole("button", { name: "Add monthly average", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("enter all four averages");
  expect(state.records()).toHaveLength(0);
  await fill(page);
  await page.getByLabel("Optional notes").fill("OHealth monthly view");
  await page.getByRole("button", { name: "Add monthly average", exact: true }).click();
  await expect(page.locator(".monthly-sleep-record")).toHaveCount(1);
  expect(state.records()[0]).toMatchObject({ year: 2025, month: 1, averageTotalSleepMinutes: 480, averageDeepMinutes: 100, averageLightMinutes: 270, averageRemMinutes: 0, notes: "OHealth monthly view" });
  await fill(page);
  await page.getByRole("button", { name: "Add monthly average", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Month", { exact: true })).toBeDisabled();
  await page.getByLabel("Average total sleep minutes", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".monthly-sleep-record")).toContainText("8 h 15 min");
  page.once("dialog", dialog => { expect(dialog.message()).toContain("return to daily-derived values"); void dialog.dismiss(); });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".monthly-sleep-record")).toHaveCount(1);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".monthly-sleep-record")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Reports now use available daily values");
});
test("server duplicate conflict retains form values", async ({ page }) => {
  const state = await setup(page); state.conflict();
  await page.goto("/#/measurements/sleep/monthly-averages"); await fill(page);
  await page.getByRole("button", { name: "Add monthly average", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(page.getByLabel("Average total sleep hours", { exact: true })).toHaveValue("8");
});
test("monthly and year reports show sources and deletion restores daily results", async ({ page }) => {
  await setup(page, [entered]);
  await page.goto("/#/reports/year-comparison?years=2025,2026&metric=sleep-total&display=table");
  await expect(page.locator('[data-year="2025"]').first()).toContainText("8 h 0 min");
  await expect(page.locator('[data-year="2025"]').first()).toContainText("Monthly average · 1 daily records present, not included");
  await expect(page.locator('[data-year="2026"]').first()).toContainText("Daily · n=1");
  await expect(page.locator('[data-year="2025"]').nth(1)).toContainText("No data");
  await page.goto("/#/reports/monthly?from=2025-01&to=2025-01&display=table");
  await expect(page.locator('[data-label="Total sleep"]')).toContainText("Monthly average");
  await page.goto("/#/measurements/sleep/monthly-averages");
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".monthly-sleep-record")).toHaveCount(0);
  await page.goto("/#/reports/monthly?from=2025-01&to=2025-01&display=table");
  await expect(page.locator('[data-label="Total sleep"]')).toContainText("6 h 40 min");
  await expect(page.locator('[data-label="Total sleep"]')).toContainText("Daily · n=1");
});
for (const [width, height, zoom] of [[320, 568, 1], [375, 667, 1], [768, 1024, 1], [1440, 1024, 1], [1280, 1024, 2]]) {
  test(`monthly management fits ${width}x${height} at ${zoom! * 100}%`, async ({ page }, testInfo) => {
    // Browser page zoom reduces the CSS viewport. Exercise the equivalent reflow
    // viewport rather than CSS zoom, which does not update media queries.
    await page.setViewportSize({ width: width! / zoom!, height: height! / zoom! }); await setup(page, [entered]);
    await page.goto("/#/measurements/sleep/monthly-averages");
    await expect(page.locator(".monthly-sleep-record")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add monthly average", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("monthly-sleep.png"), fullPage: true });
    for (const hash of ["reports/monthly?from=2025-01&to=2025-01&display=table", "reports/year-comparison?years=2025,2026&metric=sleep-total&display=table"]) {
      await page.goto(`/#/${hash}`);
      await expect(page.locator(".source-monthly-average").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
