CREATE TABLE "pap_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapy_date" date NOT NULL,
	"usage_minutes" integer,
	"events_per_hour" numeric(8, 2),
	"mask_seal_score" integer,
	"mask_on_off_count" integer,
	"total_score" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pap_records_therapy_date_unique" ON "pap_records" USING btree ("therapy_date");--> statement-breakpoint
CREATE INDEX "pap_records_therapy_date_index" ON "pap_records" USING btree ("therapy_date");