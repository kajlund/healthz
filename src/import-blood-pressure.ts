import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { desc } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import { bloodPressureReadings } from "./db/schema.js";
import { parseCsv } from "./history-import/core.js";

interface ParsedReading {
  sourceRow: number;
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  notes: string | null;
  timeResolvedFrom?: string;
}

export const cleanDateString = (rawDate: string): string => {
  const trimmed = rawDate.trim();
  // Fix known typo: 2919-12-14 -> 2019-12-14
  if (trimmed.startsWith("2919-")) {
    return `2019-${trimmed.slice(5)}`;
  }
  return trimmed;
};

export const cleanTimeString = (rawTime: string): string => {
  // Remove trailing colons, spaces, etc. E.g. "20:00: " -> "20:00"
  let trimmed = rawTime.trim().replace(/[:\s]+$/, "");
  if (!trimmed) return "";
  const parts = trimmed.split(":");
  if (parts.length >= 2) {
    const hours = parts[0]!.padStart(2, "0");
    const minutes = parts[1]!.padStart(2, "0");
    const seconds = parts[2] ? parts[2].padStart(2, "0") : "00";
    return `${hours}:${minutes}:${seconds}`;
  }
  return trimmed;
};

export const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  const [h = "0", m = "0", s = "0"] = timeStr.split(":");
  let totalMinutes = Number(h) * 60 + Number(m) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${s.padStart(2, "0")}`;
};

export const parseBloodPressureCsv = (csvContent: string): {
  readings: ParsedReading[];
  warnings: string[];
} => {
  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    throw new Error("CSV contains no data rows");
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const expectedCols = ["date", "time", "systolic", "diastolic", "pulse", "notes"];
  for (const col of expectedCols) {
    if (!header.includes(col)) {
      throw new Error(`Missing expected column: ${col}`);
    }
  }

  const colDate = header.indexOf("date");
  const colTime = header.indexOf("time");
  const colSys = header.indexOf("systolic");
  const colDia = header.indexOf("diastolic");
  const colPulse = header.indexOf("pulse");
  const colNotes = header.indexOf("notes");

  const readings: ParsedReading[] = [];
  const warnings: string[] = [];

  let lastDate: string | null = null;
  let lastTime: string | null = null;

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index]!;
    const sourceRow = index + 1; // 1-indexed line number in CSV

    const rawDate = row[colDate] ?? "";
    const rawTime = row[colTime] ?? "";
    const rawSys = row[colSys] ?? "";
    const rawDia = row[colDia] ?? "";
    const rawPulse = row[colPulse] ?? "";
    const rawNotes = row[colNotes] ?? "";

    const date = cleanDateString(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Row ${sourceRow}: Invalid date format '${rawDate}'`);
    }

    let time = cleanTimeString(rawTime);
    let timeResolvedFrom: string | undefined;

    if (!time) {
      if (lastDate === date && lastTime) {
        // Repeated measurement on the same date: place 1 minute after previous measurement
        time = addMinutesToTime(lastTime, 1);
        timeResolvedFrom = `preceding same-day reading (${lastTime} + 1m)`;
        warnings.push(`Row ${sourceRow} (${date}): Missing time resolved to ${time} from ${timeResolvedFrom}`);
      } else {
        // Standalone untimed measurement: default to 08:00:00
        time = "08:00:00";
        timeResolvedFrom = "default 08:00:00";
        warnings.push(`Row ${sourceRow} (${date}): Missing time resolved to ${time} (default)`);
      }
    }

    lastDate = date;
    lastTime = time;

    const systolic = Number(rawSys.trim());
    const diastolic = Number(rawDia.trim());
    if (!Number.isInteger(systolic) || systolic <= 0) {
      throw new Error(`Row ${sourceRow}: Invalid systolic value '${rawSys}'`);
    }
    if (!Number.isInteger(diastolic) || diastolic <= 0) {
      throw new Error(`Row ${sourceRow}: Invalid diastolic value '${rawDia}'`);
    }
    if (systolic <= diastolic) {
      throw new Error(`Row ${sourceRow}: Systolic (${systolic}) must be greater than diastolic (${diastolic})`);
    }

    let pulse: number | null = null;
    const trimmedPulse = rawPulse.trim();
    if (trimmedPulse) {
      pulse = Number(trimmedPulse);
      if (!Number.isInteger(pulse) || pulse <= 0) {
        throw new Error(`Row ${sourceRow}: Invalid pulse value '${rawPulse}'`);
      }
    }

    const trimmedNotes = rawNotes.trim();
    const notes = trimmedNotes.length > 0 ? trimmedNotes : null;

    // Construct local timestamp in local timezone
    const [yearStr, monthStr, dayStr] = date.split("-");
    const [hourStr, minStr, secStr = "0"] = time.split(":");
    const localDate = new Date(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr),
      Number(hourStr),
      Number(minStr),
      Number(secStr),
    );

    if (isNaN(localDate.getTime())) {
      throw new Error(`Row ${sourceRow}: Unable to parse timestamp ${date} ${time}`);
    }

    readings.push({
      sourceRow,
      measuredAt: localDate,
      systolic,
      diastolic,
      pulse,
      notes,
      timeResolvedFrom,
    });
  }

  return { readings, warnings };
};

const main = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;
  const filePathArg = args.find((arg) => !arg.startsWith("--"));
  const inputPath = resolve(filePathArg ?? "BloodPressureTracking.csv");

  console.log(`\n=== Blood Pressure CSV Import (${apply ? "APPLY" : "DRY RUN"}) ===`);
  console.log(`Input file: ${inputPath}`);

  const content = await readFile(inputPath, "utf8");
  const { readings, warnings } = parseBloodPressureCsv(content);

  console.log(`Total rows parsed from CSV: ${readings.length}`);
  console.log(`Warnings/resolutions count: ${warnings.length}`);

  // Fetch existing readings from database to check for conflicts/duplicates
  const existing = await db
    .select()
    .from(bloodPressureReadings)
    .orderBy(desc(bloodPressureReadings.measuredAt));

  console.log(`Existing readings in database: ${existing.length}`);

  const existingTimes = new Set(existing.map((r) => r.measuredAt.getTime()));

  const toInsert: ParsedReading[] = [];
  const exactDuplicates: ParsedReading[] = [];
  const timeCollisions: Array<{ incoming: ParsedReading; existing: typeof existing[number] }> = [];

  for (const reading of readings) {
    const timeMs = reading.measuredAt.getTime();
    if (existingTimes.has(timeMs)) {
      const match = existing.find((r) => r.measuredAt.getTime() === timeMs)!;
      if (
        match.systolic === reading.systolic &&
        match.diastolic === reading.diastolic &&
        match.pulse === reading.pulse
      ) {
        exactDuplicates.push(reading);
      } else {
        timeCollisions.push({ incoming: reading, existing: match });
      }
    } else {
      toInsert.push(reading);
    }
  }

  console.log(`New readings to insert: ${toInsert.length}`);
  console.log(`Exact duplicates already in DB: ${exactDuplicates.length}`);
  console.log(`Time collisions with differing values: ${timeCollisions.length}`);

  if (timeCollisions.length > 0) {
    console.error("Collision details:", timeCollisions);
    throw new Error("Aborting due to timestamp collisions with different values.");
  }

  if (toInsert.length > 0) {
    const dates = toInsert.map((r) => r.measuredAt.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    console.log(`Date range of new entries: ${minDate.toISOString()} to ${maxDate.toISOString()}`);
    console.log(`Earliest local: ${minDate.toLocaleString()}`);
    console.log(`Latest local:   ${maxDate.toLocaleString()}`);

    console.log("\nSample records to insert (first 3):");
    for (const r of toInsert.slice(0, 3)) {
      console.log(`  Row ${r.sourceRow}: ${r.measuredAt.toISOString()} (${r.measuredAt.toLocaleString()}) -> ${r.systolic}/${r.diastolic} mmHg, pulse=${r.pulse}, notes=${r.notes}`);
    }
    console.log("\nSample records to insert (last 3):");
    for (const r of toInsert.slice(-3)) {
      console.log(`  Row ${r.sourceRow}: ${r.measuredAt.toISOString()} (${r.measuredAt.toLocaleString()}) -> ${r.systolic}/${r.diastolic} mmHg, pulse=${r.pulse}, notes=${r.notes}`);
    }
  }

  if (apply) {
    if (toInsert.length === 0) {
      console.log("\nNothing to insert. All records already exist in the database.");
      return;
    }

    console.log(`\nInserting ${toInsert.length} readings in a transaction...`);
    await db.transaction(async (tx) => {
      // Insert in chunks of 100 for safety and performance
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        await tx.insert(bloodPressureReadings).values(
          chunk.map((r) => ({
            measuredAt: r.measuredAt,
            systolic: r.systolic,
            diastolic: r.diastolic,
            pulse: r.pulse,
            notes: r.notes,
          }))
        );
      }
    });

    // Verify insertion
    const totalAfter = await db.select().from(bloodPressureReadings);
    console.log(`\nSUCCESS: Successfully inserted ${toInsert.length} records.`);
    console.log(`Total blood pressure readings now in database: ${totalAfter.length}`);
  } else {
    console.log("\nDRY RUN complete. Run with --apply to commit these records to the database.");
  }
};

const isDirectRun =
  process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error("Import failed:", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
