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

A PAP record contains the values reported by a PAP machine or service for its `therapyDate`. The date is stored exactly as reported rather than derived from a timestamp, and only one record may exist per therapy date. At least one measurement is required, but historical records may contain only a subset of the measurements.

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

## Monthly historical summaries

Monthly Sleep and PAP summaries preserve user-entered source data for historical periods where daily records are unavailable. They are not calculated from daily records and do not create, replace, merge with, or delete daily records. Both kinds may coexist for the same month. When reporting is added later, reports will prefer available daily records and use a monthly summary only as fallback; that selection logic is not implemented yet.

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
