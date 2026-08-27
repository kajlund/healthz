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
