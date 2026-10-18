import { expect, test } from '@playwright/test';
import { sleepMetricDefinitions } from '../../api/src/sleep-records/metrics.js';
import { createSleepRecordSchema } from '../../api/src/sleep-records/schemas.js';
import { valuesFromSleepInput } from '../../api/src/sleep-records/service.js';
import { calculateMonthlyReports } from '../../api/src/reports/calculations.js';

test('settings save enabled state, order and source applicability', async ({
  page,
}, testInfo) => {
  let definitions = structuredClone(sleepMetricDefinitions);
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/sleep-metric-settings')
        return route.fulfill({ json: definitions });
      if (url.pathname.startsWith('/api/sleep-metric-settings/')) {
        const input = route.request().postDataJSON();
        definitions = definitions.map((d) =>
          d.key === 'averageSpo2' ? { ...d, ...input } : d,
        );
        return route.fulfill({ json: input });
      }
      return route.fulfill({ json: {} });
    },
  );
  await page.goto('/#/config');
  await expect(page.locator('sleep-settings')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Config', exact: true })
    .getByRole('link', { name: 'Sleep measurements', exact: true })
    .click();
  await expect(page).toHaveURL(/#\/config\/sleep-measurements$/);
  await expect(
    page.getByRole('heading', { name: 'Sleep measurements', exact: true }),
  ).toBeVisible();
  const form = page.locator('sleep-settings form').filter({
    has: page.getByRole('button', { name: 'Save Average SpO₂', exact: true }),
  });
  await form.getByLabel('Average SpO₂ (%)', { exact: true }).check();
  await form.getByLabel('Order', { exact: true }).fill('2');
  await form.getByLabel('Garmin Vivofit 5', { exact: true }).check();
  await form.getByRole('button').click();
  await expect
    .poll(() => definitions.find((d) => d.key === 'averageSpo2'))
    .toMatchObject({
      enabled: true,
      displayOrder: 2,
      sources: ['garmin-vivofit-5'],
    });
  await page.reload();
  await expect(
    form.getByLabel('Average SpO₂ (%)', { exact: true }),
  ).toBeChecked();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const size = await form
      .getByLabel('Average SpO₂ (%)', { exact: true })
      .boundingBox();
    expect(size?.width).toBe(16);
    expect(size?.height).toBe(16);
    await page.screenshot({
      path: testInfo.outputPath(`sleep-settings-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole('navigation', { name: 'Config', exact: true })
    .getByRole('link', { name: 'Data takeout', exact: true })
    .click();
  await expect(page.locator('sleep-settings')).toHaveCount(0);
});

test('score charts choose one source and show both device averages separately', async ({
  page,
}) => {
  const row = {
    sleepDate: '2026-10-18',
    totalSleepMinutes: 420,
    awakeMinutes: null,
    deepMinutes: null,
    lightMinutes: null,
    remMinutes: null,
    sleepScore: 90,
    source: 'garmin-vivofit-5',
  };
  const months = calculateMonthlyReports(['2026-10'], {
    weights: [],
    bloodPressures: [],
    papRecords: [],
    sleepRecords: [row, { ...row, source: 'oneplus-ohealth', sleepScore: 50 }],
  });
  await page.route('**/api/reports/monthly**', (route) =>
    route.fulfill({ json: { months } }),
  );
  await page.goto('/#/reports/monthly?from=2026-10&to=2026-10');
  const selector = page
    .locator('.chart-card')
    .filter({ has: page.getByRole('heading', { name: /^Sleep —/ }) })
    .getByRole('combobox');
  await selector.selectOption('sleep-score-garmin-vivofit-5');
  await expect(
    page.getByRole('heading', {
      name: 'Sleep — Sleep score · Garmin Vivofit 5',
      exact: true,
    }),
  ).toBeVisible();
  await expect(selector.locator('option[value="sleep-score"]')).toHaveCount(0);
  await page.getByText('Sleep measurements by source', { exact: true }).click();
  const details = page.locator('details').filter({
    has: page.getByText('Sleep measurements by source', { exact: true }),
  });
  await expect(details).toContainText('Sleep score: 90');
  await expect(details).toContainText('Sleep score: 50');
  expect(months[0]!.sleep.averageSleepScore.value).toBeNull();
});

test('Garmin summary keeps optional blanks and manual naps separate through edit', async ({
  page,
}) => {
  let records: unknown[] = [];
  let saved: ReturnType<typeof createSleepRecordSchema.parse> | undefined;
  await page.route('**/api/sleep-metric-settings', (route) =>
    route.fulfill({
      json: sleepMetricDefinitions.map((d) => ({
        ...d,
        enabled: [
          'averageSpo2',
          'bodyBatteryChange',
          'sleepScore',
          'awakeMinutes',
        ].includes(d.key),
        sources: d.key === 'averageSpo2' ? ['garmin-vivofit-5'] : [],
      })),
    }),
  );
  await page.route('**/api/sleep-records**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET')
      return route.fulfill({
        json: /sleep-records\//.test(request.url()) ? records[0] : records,
      });
    saved = createSleepRecordSchema.parse(request.postDataJSON());
    const record = {
      ...valuesFromSleepInput(saved),
      id: '70cd081d-2196-4cf4-b96e-de788420fe28',
      sessions: (saved.sessions ?? []).map((s, i) => ({
        ...s,
        id: String(i),
        awakeCount: s.awakeCount ?? null,
        awakeMinutes: s.awakeMinutes ?? null,
        lightMinutes: s.lightMinutes ?? null,
        deepMinutes: s.deepMinutes ?? null,
        remMinutes: s.remMinutes ?? null,
      })),
      stageCoverage: 'none',
    };
    records = [record];
    return route.fulfill({ status: 201, json: record });
  });
  await page.goto('/#/measurements/sleep/new');
  await expect(page.locator('.sleep-session-card')).toHaveCount(0);
  await page
    .getByLabel('Nightly measurement source *', { exact: true })
    .selectOption('garmin-vivofit-5');
  await expect(page.getByLabel('Average SpO₂ (%)')).toBeVisible();
  await expect(page.getByLabel('Deep hours', { exact: true })).toHaveCount(0);
  await page.getByLabel('Total sleep hours', { exact: true }).fill('7');
  await page.getByLabel('Total time awake hours', { exact: true }).fill('1');
  await page.getByLabel('Total time awake minutes', { exact: true }).fill('15');
  await page
    .getByLabel('Nightly notes (optional)', { exact: true })
    .fill('Nightly context');
  await page.getByLabel('Body Battery change (points)').fill('0');
  await page.getByRole('button', { name: 'Add nap', exact: true }).click();
  const nap = page.locator('.sleep-session-card');
  await nap.getByLabel('Total sleep minutes', { exact: true }).fill('30');
  await nap.getByLabel('From time', { exact: true }).fill('13:00');
  await nap.getByLabel('Total time awake minutes', { exact: true }).fill('5');
  await nap
    .getByLabel('Session notes (optional)', { exact: true })
    .fill('Nap context');
  // End time is optional: start date/time and duration identify the nap.
  await nap.getByLabel('To date', { exact: true }).fill('');
  await expect(nap.getByLabel('Session source', { exact: true })).toHaveValue(
    'manual',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your sleep records' }),
  ).toBeVisible();
  expect(saved).toMatchObject({
    source: 'garmin-vivofit-5',
    totalSleepMinutes: 420,
    awakeMinutes: 75,
    notes: 'Nightly context',
    measurements: { bodyBatteryChange: 0 },
    sessions: [
      {
        sessionType: 'nap',
        source: 'manual',
        totalSleepMinutes: 30,
        awakeMinutes: 5,
        label: 'Nap context',
      },
    ],
  });
  expect(saved?.measurements).not.toHaveProperty('averageSpo2');
  await expect(page.locator('.sleep-total')).toContainText('7 h 0 min');
  await page.goto(
    '/#/measurements/sleep/70cd081d-2196-4cf4-b96e-de788420fe28/edit',
  );
  await expect(page.getByLabel('Body Battery change (points)')).toHaveValue(
    '0',
  );
  await expect(page.getByLabel('Average SpO₂ (%)')).toHaveValue('');
  await expect(page.locator('.sleep-session-card')).toHaveCount(1);
  await expect(
    page.getByLabel('Nightly notes (optional)', { exact: true }),
  ).toHaveValue('Nightly context');
  await expect(
    page.getByLabel('Total time awake hours', { exact: true }).first(),
  ).toHaveValue('1');
  await expect(
    page.getByLabel('Total time awake minutes', { exact: true }).first(),
  ).toHaveValue('15');
  await expect(
    page
      .locator('.sleep-session-card')
      .getByLabel('Total time awake minutes', { exact: true }),
  ).toHaveValue('5');
  await expect(
    page.getByLabel('Session notes (optional)', { exact: true }),
  ).toHaveValue('Nap context');
});
