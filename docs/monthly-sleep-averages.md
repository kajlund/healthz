# Monthly Sleep averages

This Sleep-only feature supports historical comparisons such as 2025 versus 2026 when OHealth shows monthly nightly averages but Healthz lacks detailed daily stages. Open **Sleep → Monthly sleep averages** (`#/measurements/sleep/monthly-averages`). The separate form accepts Month, Average total sleep, Average deep sleep, Average light sleep, Average REM sleep, and optional notes, using hours/minutes inputs. These are nightly averages within a calendar month, not monthly totals. All four are required; an empty duration is unknown, while an explicitly entered zero is preserved. Editing keeps the month fixed. Deletion requires confirmation.

## Schema and API

Migration `0009_sleep_monthly_averages.sql` adds only `sleep_monthly_averages` and its unique `(year, month)` index and checks. It stores a generated UUID, year (1900–9999), month (1–12), four required integer-minute averages (0–1440 each), source (`manual` by default, bounded to 200 characters), nullable notes (2000 characters), and timezone-aware creation/update timestamps. Stage sums need not equal total sleep because source rounding may differ. There are no existing-record updates, automatically created monthly entries, PAP fields, or generic summary structures. Apply with `npm run db:migrate`.

- `GET /api/sleep-monthly-averages`, optionally `?year=2025`, returns chronological records.
- `GET /api/sleep-monthly-averages/:year/:month` retrieves one record.
- `POST /api/sleep-monthly-averages` creates a record; duplicate months return 409.
- `PUT /api/sleep-monthly-averages/:year/:month` replaces the four averages, source, and notes. Its body excludes year/month, so it cannot accidentally move an entry. Omitted source defaults to manual and omitted notes clear notes.
- `DELETE /api/sleep-monthly-averages/:year/:month` removes only that monthly entry.

POST example (integer minutes):

```json
{
  "year": 2025,
  "month": 1,
  "averageTotalSleepMinutes": 480,
  "averageDeepMinutes": 100,
  "averageLightMinutes": 270,
  "averageRemMinutes": 111,
  "source": "manual",
  "notes": "OHealth monthly view"
}
```

Malformed values return the usual 400 validation response; missing records return 404. Database checks and the unique index also protect direct writes. Each mutation is a single atomic statement; it never writes daily Sleep or session tables.

## Reporting rules

For each report month, an explicit monthly entry selects **all four** supported duration averages as one bundle, regardless of daily record count. Without an entry, existing daily calculations apply independently to known measurements; with neither source, values remain empty. There is no threshold, partial fallback, blending, weighted mixture, inferred stage value, or generated daily observation. Deleting the entry immediately restores daily-derived reporting wherever daily values exist. Daily history and session behavior remain unchanged. Sleep score, times awake, total time awake, stage coverage and session counts remain daily-only. The monthly report has no session-count metric; existing daily-list/dashboard session counts remain unchanged. PAP has complete imported daily data and retains its existing daily-only reporting and importing.

Reports return `monthly-average`, `daily`, or `none` as each metric's source. Entered averages have `sampleCount: null` because their source-night count is unknown. The Sleep report's `dailyRecordCount` always reports available Healthz daily records; entered duration metrics also carry that count for shared presentation. Tables and chart tooltips display **Monthly average** with the number of daily records present but not included, or the existing **Daily · n=…** and **No data** labels. Source is understandable without color. Daily stage coverage still describes the unchanged underlying records.

Year comparison applies the same rule separately to January–December for every selected year, including 2025 and 2026. Different months may use different sources. It adds no whole-year average and never weights a monthly entry as a known number of nights. Dashboard monthly Sleep statistics inherit the same reporting rule; latest daily readings remain daily-only.

## Export investigation

`data/health_connect_export.db` was opened read-only and all 78 table definitions searched for Sleep, monthly, average and aggregate structures. Relevant tables were `sleep_session_record_table` (session start/end timestamps, local date, title and notes) and `sleep_stages_table` (`parent_key`, `stage_start_time`, `stage_end_time`, `stage_type`). These store individual intervals, not calendar-month averages. No exact stored monthly Sleep averages were found. The supplied `SLEEP_RECORD.csv` is a PAP export, and the stage-less review CSV concerns individual daily/session data. No stages were inferred or import behavior added; manual entry remains the supported path.

## Verification

Implementation verification on 2026-09-28: migration generation and a second no-change generation passed, type checking passed, all 283 unit/database tests passed, all 34 browser tests passed, and both production builds passed. No lint/format script is configured; `git diff --check` passed. The actual development `npm run db:migrate` succeeded. That database had only migrations 0000–0007 applied: the command also applied the already-existing 0008 removal of two empty obsolete summary tables before creating the new table in 0009. Before/after row counts and content hashes confirmed all eight existing measurement/session/journal tables unchanged. The new monthly table was empty after migration.

Validation/reporting tests cover zero, missing and malformed values; sparse and complete daily coverage; bundled source choice; no blending; daily-only awake/score/coverage; mixed-source year comparison; and PAP behavior. PostgreSQL CRUD/constraint/API tests use disposable schemas (`$env:SLEEP_DATABASE_TESTS='1'; npm test`) and verify that daily records and sessions remain identical after editing/deleting monthly entries.

Browser tests cover form mapping, required values, zero, duplicates, editing, confirmation, source labels and deletion fallback. Layout checks cover 320×568, 375×667, 768×1024, 1440×1024, and the 640×512 CSS viewport equivalent to a 1280×1024 window at 200% zoom. Screenshots are saved under `test-results`.

Manual acceptance: enter a known OHealth month through Sleep → Monthly sleep averages, check its four values and source in Monthly overview and the 2025/2026 year comparison, confirm daily records remain accessible, then delete the entry and check daily fallback or No data. Also check the page with your browser's native 200% zoom and confirm PAP screens remain familiar. Automated tests use synthetic data; they do not enter or remove personal measurements.
