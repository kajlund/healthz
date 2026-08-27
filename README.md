# Healthz

Initial backend foundation for a personal health tracking application, built with Node.js, TypeScript, Express, PostgreSQL, and Drizzle ORM.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and update `DATABASE_URL` for your PostgreSQL database.
3. Run `npm run dev`.

The API is available at `http://localhost:3000`; `GET /health` returns `{ "status": "ok" }`.

## Commands

- `npm run dev` — run the API with automatic restarts
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the compiled server
- `npm test` — run tests
- `npm run typecheck` — check TypeScript without emitting files
- `npm run db:generate` — generate migrations after schema changes
- `npm run db:migrate` — apply generated migrations

No application tables are defined yet, so there is no initial migration to generate.
