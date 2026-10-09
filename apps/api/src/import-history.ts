
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "./config/env.js";
import { papRecords, sleepRecords } from "./db/schema.js";
import {
  boundaryShift, dateRange, localDateAt, papMeasurementsEqual, parsePapCsv,
  sleepMeasurementsEqual, type BoundaryShift, type ImportMode, type InvalidRecord,
  type PapImportValue, type SleepImportValue,
} from "./history-import/core.js";

interface Candidate<T> { sourceRow: number; value: T; }
interface Conflict<T, E> { sourceRow: number; incoming: T; existing: E; }
interface ReviewRow {
  sourceRow: number; sessionId: number; startDate: string; endDate: string;
  startTime: string; endTime: string; durationMinutes: number; reason: string;
}

const usage = () => {
  console.error("Usage: npm run import:history -- <pap|ohealth> <file> <--dry-run|--apply>");
  process.exitCode = 2;
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const writeReview = async (inputPath: string, rows: ReviewRow[]) => {
  const parsed = basename(inputPath, extname(inputPath));
  const outputPath = resolve(dirname(inputPath), `${parsed}.stage-less-review.csv`);
  const columns: Array<keyof ReviewRow> = ["sourceRow", "sessionId", "startDate", "endDate", "startTime", "endTime", "durationMinutes", "reason"];
  const contents = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
  await writeFile(outputPath, contents, "utf8");
  return outputPath;
};

const parseOHealth = async (inputPath: string) => {
  const database = new DatabaseSync(inputPath, { readOnly: true });
  try {
    const sessionRows = database.prepare(`
      select s.row_id, s.start_time, s.start_zone_offset, s.end_time, s.end_zone_offset,
             a.package_name, count(st.parent_key) as stage_count
      from sleep_session_record_table s
      left join sleep_stages_table st on st.parent_key = s.row_id
      left join application_info_table a on a.row_id = s.app_info_id
      group by s.row_id
      order by s.row_id
    `).all() as Array<Record<string, string | number | null>>;
    const stages = database.prepare(`
      select stage_type, stage_start_time, stage_end_time
      from sleep_stages_table where parent_key = ? order by stage_start_time
    `);
    const records: Array<Candidate<SleepImportValue>> = [];
    const excluded: ReviewRow[] = [];
    const invalid: InvalidRecord[] = [];
    const boundaryShifts: BoundaryShift[] = [];
    for (let index = 0; index < sessionRows.length; index += 1) {
      const row = sessionRows[index]!;
      const sourceRow = index + 1;
      try {
        if (row.package_name !== "com.heytap.health.international") throw new Error(`Unexpected source package: ${row.package_name}`);
        const startTime = Number(row.start_time);
        const endTime = Number(row.end_time);
        const startOffset = Number(row.start_zone_offset);
        const endOffset = Number(row.end_zone_offset);
        if (![startTime, endTime, startOffset, endOffset].every(Number.isFinite) || endTime <= startTime) throw new Error("Invalid session timestamps");
        const startDate = localDateAt(startTime, startOffset);
        const endDate = localDateAt(endTime, endOffset);
        if (Number(row.stage_count) === 0) {
          excluded.push({ sourceRow, sessionId: Number(row.row_id), startDate, endDate,
            startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString(),
            durationMinutes: Math.round((endTime - startTime) / 60000), reason: "missing detailed sleep stages" });
          continue;
        }
        const totals = { awake: 0, light: 0, deep: 0, rem: 0 };
        for (const stage of stages.all(Number(row.row_id)) as Array<Record<string, number>>) {
          const minutes = Math.round((Number(stage.stage_end_time) - Number(stage.stage_start_time)) / 60000);
          if (!Number.isInteger(minutes) || minutes < 0) throw new Error("Invalid stage duration");
          if (stage.stage_type === 1) totals.awake += minutes;
          else if (stage.stage_type === 4) totals.light += minutes;
          else if (stage.stage_type === 5) totals.deep += minutes;
          else if (stage.stage_type === 6) totals.rem += minutes;
          else throw new Error(`Unsupported stage type: ${stage.stage_type}`);
        }
        const totalSleepMinutes = totals.light + totals.deep + totals.rem;
        if (totalSleepMinutes <= 0 || totalSleepMinutes > 1440 || totals.awake > 1440) throw new Error("Calculated stage totals are outside 0–24 hours");
        records.push({ sourceRow, value: { sleepDate: endDate, totalSleepMinutes,
          awakeMinutes: totals.awake, lightMinutes: totals.light, deepMinutes: totals.deep,
          remMinutes: totals.rem, sleepScore: null, source: "OHealth import", notes: null } });
        const shift = boundaryShift(sourceRow, startDate, endDate);
        if (shift) boundaryShifts.push(shift);
      } catch (error) {
        invalid.push({ sourceRow, reason: error instanceof Error ? error.message : String(error), values: row });
      }
    }
    return { records, excluded, invalid, boundaryShifts, sourceCount: sessionRows.length };
  } finally { database.close(); }
};

const printReport = <T, E>(details: {
  mode: ImportMode; operation: "dry-run" | "apply"; inputPath: string; sourceCount: number; importable: Candidate<T>[];
  exact: Candidate<T>[]; conflicts: Array<Conflict<T, E>>; invalid: InvalidRecord[];
  zeroUsage: number[]; excluded: ReviewRow[]; boundaryShifts: BoundaryShift[]; reviewPath?: string;
}) => {
  const dates = [...details.importable, ...details.exact, ...details.conflicts.map((item) => ({ value: item.incoming }))]
    .map(({ value }) => "therapyDate" in (value as object) ? (value as PapImportValue).therapyDate : (value as SleepImportValue).sleepDate);
  console.log(`History import ${details.operation}: ${details.mode}`);
  console.log(`Input: ${details.inputPath}`);
  console.log(`Source records: ${details.sourceCount}`);
  console.log(`Importable records: ${details.importable.length}`);
  console.log(`Exact duplicates: ${details.exact.length}`);
  console.log(`Date conflicts: ${details.conflicts.length}`);
  console.log(`Invalid records: ${details.invalid.length}`);
  console.log(`Zero-usage PAP days: ${details.zeroUsage.length}`);
  console.log(`OHealth sessions excluded for missing stages: ${details.excluded.length}`);
  console.log(`Date range: ${JSON.stringify(dateRange(dates))}`);
  console.log(`Month/year boundary shifts: ${details.boundaryShifts.length}`);
  if (details.reviewPath) console.log(`Stage-less review report: ${details.reviewPath}`);
  if (details.zeroUsage.length) console.log(`Zero-usage source rows: ${details.zeroUsage.join(", ")}`);
  if (details.boundaryShifts.length) console.log(`Boundary shift details:\n${details.boundaryShifts.map((item) => JSON.stringify(item)).join("\n")}`);
  if (details.conflicts.length) console.log(`Date conflict details:\n${details.conflicts.map((item) => JSON.stringify(item)).join("\n")}`);
  if (details.invalid.length) console.log(`Invalid record details:\n${details.invalid.map((item) => JSON.stringify(item)).join("\n")}`);
  console.log(`Values that would be written (${details.importable.length}):`);
  for (const item of details.importable) console.log(JSON.stringify(item.value));
};

const main = async () => {
  const [mode, rawPath, flag, ...extra] = process.argv.slice(2);
  if ((mode !== "pap" && mode !== "ohealth") || !rawPath || (flag !== "--dry-run" && flag !== "--apply") || extra.length) return usage();
  const inputPath = resolve(process.env.INIT_CWD || process.cwd(), rawPath);
  const apply = flag === "--apply";
  if (basename(inputPath).toUpperCase() === "YEAR_AGGREGATED.CSV") {
    console.log(`Ignored ${inputPath}; yearly aggregates are not imported.`);
    return;
  }
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const database = drizzle(pool);
  try {
    if (mode === "pap") {
      const parsed = parsePapCsv(await readFile(inputPath, "utf8"));
      const existing = await database.select().from(papRecords);
      const byDate = new Map(existing.map((row) => [row.therapyDate, row]));
      const importable: typeof parsed.records = [], exact: typeof parsed.records = [];
      const conflicts: Array<Conflict<PapImportValue, typeof existing[number]>> = [];
      for (const item of parsed.records) {
        const match = byDate.get(item.value.therapyDate);
        if (!match) importable.push(item);
        else if (papMeasurementsEqual(item.value, { therapyDate: match.therapyDate, healthDate: match.healthDate,
          usageMinutes: match.usageMinutes, eventsPerHour: match.eventsPerHour,
          maskSealScore: match.maskSealScore, maskOnOffCount: match.maskOnOffCount,
          totalScore: match.totalScore })) exact.push(item);
        else conflicts.push({ sourceRow: item.sourceRow, incoming: item.value, existing: match });
      }
      printReport({ mode, operation: apply ? "apply" : "dry-run", inputPath, sourceCount: parsed.sourceCount, importable, exact, conflicts,
        invalid: parsed.invalid, zeroUsage: parsed.zeroUsage, excluded: [], boundaryShifts: parsed.boundaryShifts });
      if (apply && parsed.invalid.length) throw new Error("Apply refused because the source contains invalid PAP records");
      if (apply) await database.transaction(async (tx) => {
        for (const item of importable) {
          const inserted = await tx.insert(papRecords).values(item.value).onConflictDoNothing({ target: papRecords.therapyDate }).returning({ id: papRecords.id });
          if (inserted.length !== 1) throw new Error(`Concurrent PAP date conflict on ${item.value.therapyDate}; transaction aborted`);
        }
      });
      if (apply) console.log(`Applied ${importable.length} PAP records in one transaction. Existing records were unchanged.`);
    } else {
      const parsed = await parseOHealth(inputPath);
      const reviewPath = await writeReview(inputPath, parsed.excluded);
      const existing = await database.select().from(sleepRecords);
      const byDate = new Map(existing.map((row) => [row.sleepDate, row]));
      const importable: typeof parsed.records = [], exact: typeof parsed.records = [];
      const conflicts: Array<Conflict<SleepImportValue, typeof existing[number]>> = [];
      for (const item of parsed.records) {
        const match = byDate.get(item.value.sleepDate);
        if (!match) importable.push(item);
        else if (sleepMeasurementsEqual(item.value, { sleepDate: match.sleepDate, totalSleepMinutes: match.totalSleepMinutes,
          awakeMinutes: match.awakeMinutes, lightMinutes: match.lightMinutes,
          deepMinutes: match.deepMinutes, remMinutes: match.remMinutes, sleepScore: match.sleepScore })) exact.push(item);
        else conflicts.push({ sourceRow: item.sourceRow, incoming: item.value, existing: match });
      }
      printReport({ mode, operation: apply ? "apply" : "dry-run", inputPath, sourceCount: parsed.sourceCount, importable, exact, conflicts,
        invalid: parsed.invalid, zeroUsage: [], excluded: parsed.excluded, boundaryShifts: parsed.boundaryShifts, reviewPath });
      if (apply && parsed.invalid.length) throw new Error("Apply refused because the source contains invalid OHealth records");
      if (apply) await database.transaction(async (tx) => {
        for (const item of importable) {
          const inserted = await tx.insert(sleepRecords).values(item.value).onConflictDoNothing({ target: sleepRecords.sleepDate }).returning({ id: sleepRecords.id });
          if (inserted.length !== 1) throw new Error(`Concurrent sleep date conflict on ${item.value.sleepDate}; transaction aborted`);
        }
      });
      if (apply) console.log(`Applied ${importable.length} OHealth sleep records in one transaction. Existing records were unchanged.`);
    }
  } finally { await pool.end(); }
};

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
