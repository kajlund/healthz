import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    detailMode: text("detail_mode", { enum: ["summary", "sessions"] }).default("summary").notNull(),
    awakeCount: integer("awake_count"),
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
    check("sleep_records_detail_mode_check", sql`${table.detailMode} in ('summary', 'sessions')`),
    check("sleep_records_awake_count_check", sql`${table.awakeCount} >= 0`),
  ],
);

export const sleepSessions = pgTable(
  "sleep_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sleepRecordId: uuid("sleep_record_id").notNull().references(() => sleepRecords.id, { onDelete: "cascade" }),
    sessionType: text("session_type", { enum: ["main-sleep", "nap", "other"] }).notNull(),
    label: text("label"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    totalSleepMinutes: integer("total_sleep_minutes").notNull(),
    awakeMinutes: integer("awake_minutes"),
    awakeCount: integer("awake_count"),
    lightMinutes: integer("light_minutes"),
    deepMinutes: integer("deep_minutes"),
    remMinutes: integer("rem_minutes"),
    sortOrder: integer("sort_order").notNull(),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sleep_sessions_parent_order_index").on(table.sleepRecordId, table.sortOrder, table.startedAt, table.id),
    check("sleep_sessions_type_check", sql`${table.sessionType} in ('main-sleep', 'nap', 'other')`),
    check("sleep_sessions_total_check", sql`${table.totalSleepMinutes} > 0`),
    check("sleep_sessions_measurements_check", sql`${table.awakeMinutes} >= 0 and ${table.awakeCount} >= 0 and ${table.lightMinutes} >= 0 and ${table.deepMinutes} >= 0 and ${table.remMinutes} >= 0`),
    check("sleep_sessions_order_check", sql`${table.sortOrder} >= 0`),
    check("sleep_sessions_times_check", sql`${table.endedAt} > ${table.startedAt}`),
  ],
);

export const papRecords = pgTable(
  "pap_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    therapyDate: date("therapy_date", { mode: "string" }).notNull(),
    healthDate: date("health_date", { mode: "string" }),
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
    index("pap_records_health_date_index").on(table.healthDate),
  ],
);

export const healthcareEvents = pgTable(
  "healthcare_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    eventTime: time("event_time", { withTimezone: false, precision: 0 }),
    title: text("title").notNull(),
    description: text("description"),
    provider: text("provider"),
    organization: text("organization"),
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("healthcare_events_date_index").on(table.eventDate),
    index("healthcare_events_date_time_index").on(table.eventDate, table.eventTime),
  ],
);

export const healthcareTags = pgTable(
  "healthcare_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("healthcare_tags_normalized_name_unique").on(table.normalizedName)],
);

export const healthcareEventTags = pgTable(
  "healthcare_event_tags",
  {
    healthcareEventId: uuid("healthcare_event_id").notNull().references(() => healthcareEvents.id, { onDelete: "cascade" }),
    healthcareTagId: uuid("healthcare_tag_id").notNull().references(() => healthcareTags.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ name: "healthcare_event_tags_pk", columns: [table.healthcareEventId, table.healthcareTagId] }),
    index("healthcare_event_tags_tag_index").on(table.healthcareTagId),
  ],
);
