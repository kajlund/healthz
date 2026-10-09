import { expect, test, type Page } from "@playwright/test";
import { calculateMonthlyReports, monthsBetween } from "../../api/src/reports/calculations.js";
import type { ReportData } from "../../api/src/reports/types.js";

const data: ReportData = {
  weights: [], bloodPressures: [], papRecords: [
    { therapyDate: "2026-08-31", healthDate: "2026-09-01", usageMinutes: 420, eventsPerHour: 0, maskSealScore: null, maskOnOffCount: null, totalScore: null },
    { therapyDate: "2026-09-01", healthDate: "2026-09-02", usageMinutes: 480, eventsPerHour: null, maskSealScore: null, maskOnOffCount: null, totalScore: null },
  ],
  sleepRecords: [
    { sleepDate: "2025-09-01", totalSleepMinutes: 420, awakeCount: 0, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 80, remMinutes: 100, sleepScore: 80, stageCoverage: "complete" },
    { sleepDate: "2026-09-01", totalSleepMinutes: 420, awakeCount: 0, awakeMinutes: 18, lightMinutes: 240, deepMinutes: 80, remMinutes: 100, sleepScore: 80, stageCoverage: "complete" },
    { sleepDate: "2026-09-02", totalSleepMinutes: 460, awakeCount: null, awakeMinutes: null, lightMinutes: null, deepMinutes: null, remMinutes: null, sleepScore: null, stageCoverage: "partial" },
    { sleepDate: "2026-09-03", totalSleepMinutes: 480, awakeCount: 3, awakeMinutes: 18, lightMinutes: null, deepMinutes: null, remMinutes: null, sleepScore: 90, stageCoverage: "none" },
  ],
};

test("dashboard navigation offers detailed entry and monthly reports without stored summaries", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quick actions" })).toBeVisible();
  await expect(page.locator('a[href*="/summaries/"]')).toHaveCount(0);
  await expect(page.locator(".primary-nav")).not.toContainText("Summaries");
  const pap = page.locator(".snapshot-card").filter({ has: page.getByRole("heading", { name: "PAP", exact: true }) });
  await pap.getByRole("link").click();
  await expect(page).toHaveURL(/reports\/monthly\?from=2026-09&to=2026-09/);
  await expect(page.getByRole("heading", { name: "Monthly overview" })).toBeVisible();
});

test("PAP monthly statistics use daily values and leave missing months empty", async ({ page }) => {
  await setup(page);
  await page.goto("/#/reports/monthly?from=2026-08&to=2026-09&display=table");
  const pap = page.locator(".report-card").filter({ has: page.getByRole("heading", { name: "PAP", exact: true }) });
  await expect(pap.locator('[data-label="Usage"]').first()).toContainText("No data");
  await expect(pap.locator('[data-label="Usage"]').last()).toContainText("7 h 30 min");
  await expect(pap.locator('[data-label="Usage"]').last()).toContainText("Daily · n=2");
  await expect(pap.locator('[data-label="Events per hour"]').last()).toContainText("0.00 events/hour");
  await expect(pap.locator('[data-label="Mask seal score"]').last()).toContainText("No data");
  await page.goto("/#/reports/monthly?from=2026-08&to=2026-08");
  for (const name of [/^Sleep/, /^PAP/]) {
    const card = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name }) });
    await expect(card).toContainText("No data for this range");
  }
});
const setup = async (page: Page) => {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/reports/monthly") return route.fulfill({ json: { months: calculateMonthlyReports(monthsBetween(url.searchParams.get("from")!, url.searchParams.get("to")!), data) } });
    if (url.pathname === "/api/reports/year-over-year") {
      const years = url.searchParams.get("years")!.split(",").map(Number);
      return route.fulfill({ json: { meta: { years, generatedAt: "", monthCount: years.length * 12 }, series: years.map((year) => ({ year, months: calculateMonthlyReports(monthsBetween(`${year}-01`, `${year}-12`), data) })) } });
    }
    if (url.pathname === "/api/dashboard") {
      const trend = calculateMonthlyReports(monthsBetween("2025-10", "2026-09"), data);
      return route.fulfill({ json: { referenceMonth: "2026-09", previousMonth: "2026-08", generatedAt: "", trend, currentMonth: trend.at(-1), previousMonthData: trend.at(-2), healthcare: { latestPast: null, nextFuture: null }, latest: {
        weight: null, bloodPressure: null, pap: null, sleep: { sleepDate: "2026-09-03", totalSleepMinutes: 480, sleepScore: 90, awakeCount: 0, detailMode: "sessions", sessionCount: 2, napCount: 1 },
      } } });
    }
    return route.fulfill({ json: [] });
  });
};

test("Sleep tables distinguish counts and durations with metric samples and daily coverage", async ({ page }) => {
  await setup(page);
  await page.goto("/#/reports/monthly?from=2026-08&to=2026-09&display=table");
  const sleep = page.locator(".report-card").filter({ has: page.getByRole("heading", { name: "Sleep", exact: true }) });
  await expect(sleep.locator('[data-label="Average times awake"]').last()).toContainText("1.50 times");
  await expect(sleep.locator('[data-label="Average times awake"]').last()).toContainText("Daily · n=2");
  await expect(sleep.locator('[data-label="Average times awake"]').first()).toContainText("No data");
  await expect(sleep.locator('[data-label="Total time awake"]').last()).toContainText("0 h 18 min");
  await expect(sleep.locator('[data-label="Total time awake"]').first()).toContainText("No data");
  await expect(sleep.locator(".report-coverage").last()).toContainText("1 complete, 1 partial, 1 without stages");
  await expect(sleep.locator('[data-label="Light sleep"]').last()).toContainText("Daily · n=1");
});

test("Sleep chart selector renders a single count series and exposes coverage", async ({ page }) => {
  await setup(page);
  await page.goto("/#/reports/monthly?from=2026-08&to=2026-09");
  const sleep = page.locator(".chart-card").filter({ has: page.getByRole("heading", { name: /^Sleep/ }) });
  await sleep.getByRole("combobox").selectOption("sleep-awake-count");
  await expect(sleep.getByRole("heading")).toHaveText("Sleep — Average times awake");
  await expect(sleep.getByRole("img")).toBeVisible();
  const chart = await sleep.locator("report-chart").evaluate((element) => {
    const el = element as unknown as { data: { datasets: Array<{ data: unknown[] }> }; options: { scales: { y: { ticks: { callback: (v: number) => string } } } } };
    return { count: el.data.datasets.length, values: el.data.datasets[0]!.data, tick: el.options.scales.y.ticks.callback(1.5) };
  });
  expect(chart).toEqual({ count: 1, values: [null, 1.5], tick: "1.50 times" });
  await page.getByText("Sleep stage coverage by month", { exact: true }).click();
  await expect(page.locator(".report-coverage-notes")).toContainText("1 complete, 1 partial, 1 without stages");
});

test("year comparison supports Average times awake in charts and tables", async ({ page }) => {
  await setup(page);
  await page.goto("/#/reports/year-comparison?years=2025,2026&metric=sleep-awake-count");
  await expect(page.locator(".chart-card").getByRole("heading")).toHaveText("Average times awake");
  await expect(page.getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "Tables", exact: true }).click();
  await expect(page.locator('[data-year="2025"]').nth(8)).toContainText("0.00 times");
  await expect(page.locator('[data-year="2026"]').nth(8)).toContainText("1.50 times");
  await expect(page.locator('[data-year="2026"]').nth(8)).toContainText("Daily · n=2");
  await expect(page.locator('[data-year="2026"]').nth(8)).toContainText("1 complete, 1 partial, 1 without stages");
});

for (const width of [320, 1440]) {
  test(`Dashboard Sleep cards and report tables fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.goto("/?month=2026-09");
    const latest = page.locator(".latest-card").filter({ has: page.getByRole("heading", { name: "Sleep", exact: true }) });
    await expect(latest).toContainText("Times awake: 0");
    await expect(latest).toContainText("2 sessions, including 1 nap");
    const snapshot = page.locator(".snapshot-card").filter({ has: page.getByRole("heading", { name: "Sleep", exact: true }) });
    await expect(snapshot).toContainText("Average times awake");
    await expect(snapshot).toContainText("1.50 times");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), fullPage: true });
    await page.goto("/#/reports/monthly?from=2026-08&to=2026-09&display=table");
    await expect(page.locator('[data-label="Average times awake"]').last()).toContainText("1.50 times");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`reports-${width}.png`), fullPage: true });
  });
}
