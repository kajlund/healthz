CREATE TABLE "sleep_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sleep_date" date NOT NULL,
	"total_sleep_minutes" integer NOT NULL,
	"awake_minutes" integer,
	"light_minutes" integer,
	"deep_minutes" integer,
	"rem_minutes" integer,
	"sleep_score" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_records_sleep_date_unique" ON "sleep_records" USING btree ("sleep_date");--> statement-breakpoint
CREATE INDEX "sleep_records_sleep_date_index" ON "sleep_records" USING btree ("sleep_date");