import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';

describe.skipIf(process.env.SLEEP_DATABASE_TESTS !== '1')(
  'stored summary removal migration',
  () => {
    it('drops populated obsolete tables while preserving all detailed and unrelated rows', async () => {
      const schema = `healthz_removal_test_${randomUUID().replaceAll('-', '')}`;
      if (!/^healthz_removal_test_[a-f0-9]{32}$/.test(schema))
        throw new Error('Unsafe test schema');
      const admin = new Pool({ connectionString: env.DATABASE_URL });
      const pool = new Pool({
        connectionString: env.DATABASE_URL,
        options: `-c search_path=${schema}`,
      });
      const migration = async (tag: string) =>
        (
          await readFile(
            new URL(`../drizzle/${tag}.sql`, import.meta.url),
            'utf8',
          )
        ).replaceAll('"public".', `"${schema}".`);
      try {
        await admin.query(`CREATE SCHEMA "${schema}"`);
        const journal = JSON.parse(
          await readFile(
            new URL('../drizzle/meta/_journal.json', import.meta.url),
            'utf8',
          ),
        ) as { entries: Array<{ idx: number; tag: string }> };
        for (const entry of journal.entries.filter(({ idx }) => idx < 8))
          await pool.query(await migration(entry.tag));
        await pool.query(`
        INSERT INTO monthly_pap_summaries (summary_month, average_usage_minutes) VALUES ('2026-09-01', 600);
        INSERT INTO monthly_sleep_summaries (summary_month, average_total_sleep_minutes) VALUES ('2026-09-01', 600);
        INSERT INTO body_measurements (measured_on, weight_kg) VALUES ('2026-09-01', 80);
        INSERT INTO blood_pressure_readings (measured_at, systolic, diastolic) VALUES ('2026-09-01T10:00:00Z', 120, 80);
        INSERT INTO pap_records (therapy_date, health_date, usage_minutes) VALUES ('2026-08-31', '2026-09-01', 420);
        INSERT INTO sleep_records (sleep_date, total_sleep_minutes, detail_mode) VALUES ('2026-09-01', 450, 'sessions');
        INSERT INTO sleep_sessions (sleep_record_id, session_type, total_sleep_minutes, sort_order)
          SELECT id, 'main-sleep', 420, 0 FROM sleep_records;
        INSERT INTO sleep_sessions (sleep_record_id, session_type, total_sleep_minutes, sort_order)
          SELECT id, 'nap', 30, 1 FROM sleep_records;
        INSERT INTO healthcare_events (event_date, title) VALUES ('2026-09-01', 'Checkup');
        INSERT INTO healthcare_tags (name, normalized_name) VALUES ('Test', 'test');
        INSERT INTO healthcare_event_tags SELECT e.id, t.id FROM healthcare_events e CROSS JOIN healthcare_tags t;
      `);
        const tables = [
          'body_measurements',
          'blood_pressure_readings',
          'pap_records',
          'sleep_records',
          'sleep_sessions',
          'healthcare_events',
          'healthcare_tags',
          'healthcare_event_tags',
        ];
        const snapshot = async () =>
          Promise.all(
            tables.map(
              async (table) =>
                (await pool.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows,
            ),
          );
        const before = await snapshot();
        const constraints = async () =>
          (
            await pool.query(
              "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = $1::regnamespace AND conrelid NOT IN ('monthly_pap_summaries'::regclass, 'monthly_sleep_summaries'::regclass) ORDER BY conname",
              [schema],
            )
          ).rows;
        const beforeConstraints = await constraints();
        await pool.query(await migration('0008_remove_stored_summaries'));
        expect(await snapshot()).toEqual(before);
        expect(
          (
            await pool.query(
              'SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = $1::regnamespace ORDER BY conname',
              [schema],
            )
          ).rows,
        ).toEqual(beforeConstraints);
        expect(
          (
            await pool.query(
              'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
              [schema],
            )
          ).rows.map(({ tablename }) => tablename),
        ).toEqual([...tables].sort());
        expect(
          (
            await pool.query(
              "SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename LIKE 'monthly_%'",
              [schema],
            )
          ).rows,
        ).toEqual([]);
      } finally {
        await pool.end();
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await admin.end();
      }
    });
  },
);
