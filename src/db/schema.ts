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
