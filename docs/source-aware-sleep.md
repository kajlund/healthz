# Sleep sources and optional measurements

Run `npm run db:migrate` before starting the updated application. Migration
`0010_source_aware_sleep` adds a small measurement settings table, a JSON object
for extended optional measurements, and a total-scope marker. It can be repeated
without replacing settings. It does not rewrite historical records, sessions,
sources, labels, timestamps, or monthly averages. Existing stage columns remain
the only storage for stage durations.

New entries default to a nightly summary: wake-up date, source and total sleep.
Choose Manual, OnePlus / OHealth, or Garmin Vivofit 5. Existing source strings
remain selectable when editing. Optional measurements are enabled, ordered and
restricted to sources in the separate Config → Sleep measurements tab
(`#/config/sleep-measurements`). Data takeout remains in its
own Config tab. All sources apply
when none are selected. Blank values mean not recorded; zero is retained when
explicitly entered. Hidden values remain stored when editing.

Use Add nap to record a manual nap with its start date/time and duration. New
nightly totals and stages exclude naps. Main sleep can alternatively be entered
as sessions. Historical records keep their original daily totals (which may
include naps) and are labelled accordingly, including when edited. The app does
not recalculate historical totals during migration. No including-naps total is
inferred for summary-only records.

Session “Label” is now “Session notes”; its stored value is unchanged. It still
appears beside the session type in history. Nightly notes apply to the whole
night, while session notes apply to one session. The nightly measurement source
identifies the provider of nightly measurements and scores; session source
identifies the provider of that session and can inherit the nightly source.
Total time awake is edited as separate hours and minutes, just like stage
durations, and remains stored as total minutes. Blank duration fields stay
unrecorded; an explicitly entered zero remains zero.

Reports group sleep scores by source. Known OnePlus/OHealth aliases share one
group; unfamiliar sources remain separate. The compatibility average score is
empty in months with multiple sources. Charts offer a separate metric for each
standard source; the source detail table includes all historical sources and
extended measurements. Extended measurements currently use averages and remain
separate by source, even when comparable. Definition types, units, formatting,
comparability and aggregation are fixed in code; settings expose only enabled
state, order and source applicability, rather than a custom form builder.

Entered monthly averages keep their existing priority for sleep durations and
stages. No new measurements, sessions, device factors or historical naps are
fabricated. This change does not permit multiple nightly records on the same
date; the existing one-record-per-date constraint remains.

Focused PostgreSQL tests use disposable schemas: set `SLEEP_DATABASE_TESTS=1`
and run the API tests. Migration repeatability, configuration retention and
record preservation are covered there.
