CREATE TABLE "blood_pressure_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"systolic" integer NOT NULL,
	"diastolic" integer NOT NULL,
	"pulse" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "blood_pressure_readings_measured_at_index" ON "blood_pressure_readings" USING btree ("measured_at");