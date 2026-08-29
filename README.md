# Healthz

A personal health tracking application built with Lit, TypeScript, Express, PostgreSQL, and Drizzle ORM.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and update `DATABASE_URL` for your PostgreSQL database.
3. Apply the database migrations with `npm run db:migrate`.
4. Run `npm run dev`.

Open the frontend at `http://localhost:5173`. Vite proxies API requests to Express, which runs on the configured `PORT` (3000 by default), so frontend code does not need an environment-specific API URL.

The root route is the Dashboard. Its optional browser-local reference month is stored as `/?month=YYYY-MM`; all existing hash routes remain available.

## Commands

- `npm run dev` - run the API and Vite frontend together
- `npm run dev:api` - run only the API with automatic restarts
- `npm run dev:web` - run only the Vite frontend
- `npm run build` - build the API and frontend into `dist/`
- `npm start` - serve the production API and built frontend
- `npm test` - run tests
- `npm run typecheck` - check TypeScript without emitting files
- `npm run db:generate` - generate migrations after schema changes
- `npm run db:migrate` - apply generated migrations

## Body-weight API

Body measurements use ISO calendar dates (`YYYY-MM-DD`) and kilogram values with up to two decimal places. Only one measurement may exist for each date.

Create a measurement:

```sh
curl -X POST http://localhost:3000/api/body-measurements \
  -H "Content-Type: application/json" \
  -d '{"measuredOn":"2026-08-27","weightKg":82.45,"notes":"Morning"}'
```

Available endpoints:

- `POST /api/body-measurements` - create a measurement
- `GET /api/body-measurements` - list measurements, newest measurement date first
- `GET /api/body-measurements/:id` - get one measurement
- `PUT /api/body-measurements/:id` - replace a measurement
- `DELETE /api/body-measurements/:id` - delete a measurement

Example request body for create and update:

```json
{
  "measuredOn": "2026-08-27",
  "weightKg": 82.45,
  "notes": "Morning"
}
```

## Production

Build both applications, then start Express:

```sh
npm run build
npm start
```

Express serves the generated frontend from `dist/public` and continues to handle all `/api` routes.

`notes` may be omitted or set to `null`. Validation, missing-resource, and date-conflict errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

## Blood-pressure API

Blood-pressure readings use ISO 8601 timestamps and allow multiple readings on the same day. Apply migration `0001_goofy_the_watchers.sql` with `npm run db:migrate` before using these endpoints.

Create a reading:

```sh
curl -X POST http://localhost:3000/api/blood-pressure-readings \
  -H "Content-Type: application/json" \
  -d '{"measuredAt":"2026-08-27T18:30:00.000Z","systolic":122,"diastolic":78,"pulse":64,"notes":"After dinner"}'
```

Available endpoints:

- `POST /api/blood-pressure-readings` - create a reading
- `GET /api/blood-pressure-readings` - list readings, newest first
- `GET /api/blood-pressure-readings/:id` - get one reading
- `PUT /api/blood-pressure-readings/:id` - replace a reading
- `DELETE /api/blood-pressure-readings/:id` - delete a reading

Example request body for create and update:

```json
{
  "measuredAt": "2026-08-27T18:30:00.000Z",
  "systolic": 122,
  "diastolic": 78,
  "pulse": 64,
  "notes": "After dinner"
}
```

`pulse` and `notes` may be omitted or set to `null`. Systolic pressure must be greater than diastolic pressure.

## Daily-sleep API

A sleep record describes the main sleep period ending on `sleepDate`. For example, sleep that begins Thursday night and ends Friday morning uses Friday's date. Durations are integer minutes, `totalSleepMinutes` excludes awake time, and only one record may exist per sleep date. Stage totals are allowed to differ from total sleep.

Apply migration `0002_burly_mac_gargan.sql` with `npm run db:migrate` before using these endpoints.

Available endpoints:

- `POST /api/sleep-records` - create a daily sleep record
- `GET /api/sleep-records` - list records by sleep date, newest first
- `GET /api/sleep-records/:id` - get one record
- `PUT /api/sleep-records/:id` - replace one record
- `DELETE /api/sleep-records/:id` - delete one record

Example request body for create and update:

```json
{
  "sleepDate": "2026-08-28",
  "totalSleepMinutes": 444,
  "awakeMinutes": 31,
  "lightMinutes": 250,
  "deepMinutes": 90,
  "remMinutes": 100,
  "sleepScore": 86,
  "source": "manual",
  "notes": "Felt rested"
}
```

`awakeMinutes`, stage durations, `sleepScore`, and `notes` may be omitted or set to `null`. Each duration is limited to 1,440 minutes; total sleep must be greater than zero. Source is required and defaults to `manual` at the database level.

## Daily PAP API

A PAP record preserves two calendar dates. `therapyDate` is the PAP date shown by the machine or service, normally when the overnight session began. `healthDate` is the wake-up date Healthz uses to align the session with Sleep. Only one record may exist per PAP date. At least one measurement is required, but historical records may contain only a subset of the measurements.

New records and full updates require both dates. The form defaults Health date to the following calendar day until the user manually edits it; unusual sessions may use any valid Health date. Migration `0005_adorable_sinister_six.sql` leaves existing rows with `healthDate: null`, so they must be corrected manually when edited. Legacy rows remain readable and deletable, and opening the form never saves a derived date.

Apply migration `0003_kind_may_parker.sql` with `npm run db:migrate` before using these endpoints.

Available endpoints:

- `POST /api/pap-records` - create a daily PAP record
- `GET /api/pap-records` - list records by therapy date, newest first
- `GET /api/pap-records/:id` - get one record
- `PUT /api/pap-records/:id` - replace one record
- `DELETE /api/pap-records/:id` - delete one record

Example request body for create and update:

```json
{
  "therapyDate": "2026-08-28",
  "healthDate": "2026-08-29",
  "usageMinutes": 438,
  "eventsPerHour": 2.35,
  "maskSealScore": 18,
  "maskOnOffCount": 2,
  "totalScore": 91,
  "source": "manual",
  "notes": "Good seal"
}
```

All measurements are optional individually and remain `null` when absent; at least one must be supplied. `usageMinutes` is limited to 1,440, `eventsPerHour` supports two decimal places, and `totalScore` is limited to 0–100. The fixed-precision database value for `eventsPerHour` is returned by the API as a JSON number.

Daily PAP reports use `healthDate`. Existing rows without it temporarily fall back to `therapyDate` for bounded queries and grouping; the fallback is never persisted. Monthly PAP summaries retain their stored PAP-service `summaryMonth` and are never shifted. A daily-derived report may therefore align an overnight session to the following month while a historical PAP-source summary remains in its original month.

## Monthly historical summaries

Monthly Sleep and PAP summaries preserve user-entered source data for historical periods where daily records are unavailable. They are not calculated from daily records and do not create, replace, merge with, or delete daily records. Both kinds may coexist for the same month. Reports prefer available daily records and use a monthly summary only as metric-level fallback.

The API exposes `summaryMonth` as `YYYY-MM`. PostgreSQL stores it as the first day of that month—for example, `2025-03` is stored as `2025-03-01`. Only one summary of each type may exist per month. Apply migration `0004_rare_amazoness.sql` with `npm run db:migrate` before using these endpoints.

Monthly Sleep endpoints:

- `POST /api/monthly-sleep-summaries`
- `GET /api/monthly-sleep-summaries` - newest month first
- `GET /api/monthly-sleep-summaries/:id`
- `PUT /api/monthly-sleep-summaries/:id`
- `DELETE /api/monthly-sleep-summaries/:id`

Monthly Sleep request fields are `summaryMonth`, `averageTotalSleepMinutes`, `averageAwakeMinutes`, `averageLightMinutes`, `averageDeepMinutes`, `averageRemMinutes`, `averageSleepScore`, `daysRecorded`, `source`, and `notes`. Durations are average daily minutes; the score supports two decimal places.

Monthly PAP endpoints:

- `POST /api/monthly-pap-summaries`
- `GET /api/monthly-pap-summaries` - newest month first
- `GET /api/monthly-pap-summaries/:id`
- `PUT /api/monthly-pap-summaries/:id`
- `DELETE /api/monthly-pap-summaries/:id`

Monthly PAP request fields are `summaryMonth`, `averageUsageMinutes`, `averageEventsPerHour`, `averageMaskSealScore`, `averageMaskOnOffCount`, `averageTotalScore`, `daysRecorded`, `source`, and `notes`. Decimal averages support two decimal places and are returned as JSON numbers.

For either summary type, at least one average measurement is required. Missing averages remain `null`. `daysRecorded`, when supplied, must be positive and cannot exceed the actual number of days in the selected month, including leap-year February.

## Reports

Reports are calculated on request and never modify or persist source records. The reporting service executes six bounded source queries for a requested range—Weight, Blood pressure, daily Sleep, daily PAP, monthly Sleep summaries, and monthly PAP summaries—then performs reusable calculations in memory. No query is issued per month or metric.

Monthly report:

```sh
curl "http://localhost:3000/api/reports/monthly?from=2025-01&to=2025-12"
```

- `GET /api/reports/monthly?from=YYYY-MM&to=YYYY-MM`
- Both parameters are required, `from` cannot follow `to`, and the range is limited to 120 months.
- Every requested month is returned oldest first, including empty months.

Year comparison:

```sh
curl "http://localhost:3000/api/reports/year-over-year?years=2024,2025,2026"
```

- `GET /api/reports/year-over-year?years=2024,2025`
- Years are validated, deduplicated, sorted, and limited to 10.
- January through December is returned for every selected year, including empty months.

Weight reports include average, minimum, maximum, first, last, and measurement count. Blood-pressure readings are averaged within each UTC calendar day first, then those daily averages receive equal weight in the monthly result. Pulse uses only days containing at least one pulse value.

Sleep and PAP fallback is applied independently per metric. When any daily value exists for a metric, only daily values are averaged and its source is `daily`. Otherwise the stored monthly average is used with source `monthly-summary`. If neither exists, the value is `null` with source `none`. Daily and summary values are never combined. `sampleCount` is the number of contributing daily values, or the summary's `daysRecorded` when summary fallback is used.

Frontend report routes:

- `#/reports/monthly` — Monthly overview, with optional `from` and `to` hash-query parameters
- `#/reports/year-comparison` — Year comparison, with optional `years` and `metric` hash-query parameters

## Dashboard

The Dashboard is available at `/` and loads one read-only response:

```sh
curl "http://localhost:3000/api/dashboard?month=2026-08"
```

`month` is required by the API and represents the user's explicit calendar reference month; the browser supplies its current local `YYYY-MM` by default. The response contains `referenceMonth`, `previousMonth`, the latest overall Weight, Blood pressure, Sleep and PAP records, current and previous monthly report objects, a 12-month `trend`, and `generatedAt`.

Latest records are newest overall and are not restricted to the reference month; each includes its date or timestamp. Four bounded newest-record queries run alongside one 12-month reporting-service call. The report call remains the source of all monthly statistics and Sleep/PAP fallback behavior, and nothing is persisted.

Comparisons subtract the previous calendar month's existing report values at displayed precision. Missing operands produce “Not enough data”; null is never treated as zero, and direction is mathematical rather than medical. Dashboard charts consume the returned monthly report results and preserve missing values as gaps.
