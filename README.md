# Healthz

Backend for a personal health tracking application, built with Node.js, TypeScript, Express, PostgreSQL, and Drizzle ORM.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and update `DATABASE_URL` for your PostgreSQL database.
3. Apply the database migrations with `npm run db:migrate`.
4. Run `npm run dev`.

The API is available at `http://localhost:3000`; `GET /health` returns `{ "status": "ok" }`.

## Commands

- `npm run dev` - run the API with automatic restarts
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled server
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

`notes` may be omitted or set to `null`. Validation, missing-resource, and date-conflict errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```
