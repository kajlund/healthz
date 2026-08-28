import { date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    measuredOn: date("measured_on", { mode: "string" }).notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("body_measurements_measured_on_unique").on(table.measuredOn)],
);

export const bloodPressureReadings = pgTable(
  "blood_pressure_readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    systolic: integer("systolic").notNull(),
    diastolic: integer("diastolic").notNull(),
    pulse: integer("pulse"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("blood_pressure_readings_measured_at_index").on(table.measuredAt)],
);

export const sleepRecords = pgTable(
  "sleep_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sleepDate: date("sleep_date", { mode: "string" }).notNull(),
    totalSleepMinutes: integer("total_sleep_minutes").notNull(),
    awakeMinutes: integer("awake_minutes"),
    lightMinutes: integer("light_minutes"),
    deepMinutes: integer("deep_minutes"),
    remMinutes: integer("rem_minutes"),
    sleepScore: integer("sleep_score"),
    source: text("source").default("manual").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sleep_records_sleep_date_unique").on(table.sleepDate),
    index("sleep_records_sleep_date_index").on(table.sleepDate),
  ],
);

export const papRecords = pgTable(
  "pap_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    therapyDate: date("therapy_date", { mode: "string" }).notNull(),
    usageMinutes: integer("usage_minutes"),
    eventsPerHour: numeric("events_per_hour", { precision: 8, scale: 2, mode: "number" }),
    maskSealScore: integer("mask_seal_score"),
    maskOnOffCount: integer("mask_on_off_count"),
    totalScore: integer("total_score"),
    source: text("source").default("manual").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pap_records_therapy_date_unique").on(table.therapyDate),
    index("pap_records_therapy_date_index").on(table.therapyDate),
  ],
);
