import { date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
