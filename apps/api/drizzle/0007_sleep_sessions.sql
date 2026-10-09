CREATE TABLE "sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sleep_record_id" uuid NOT NULL,
	"session_type" text NOT NULL,
	"label" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"total_sleep_minutes" integer NOT NULL,
	"awake_minutes" integer,
	"awake_count" integer,
	"light_minutes" integer,
	"deep_minutes" integer,
	"rem_minutes" integer,
	"sort_order" integer NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sleep_sessions_type_check" CHECK ("sleep_sessions"."session_type" in ('main-sleep', 'nap', 'other')),
	CONSTRAINT "sleep_sessions_total_check" CHECK ("sleep_sessions"."total_sleep_minutes" > 0),
	CONSTRAINT "sleep_sessions_measurements_check" CHECK ("sleep_sessions"."awake_minutes" >= 0 and "sleep_sessions"."awake_count" >= 0 and "sleep_sessions"."light_minutes" >= 0 and "sleep_sessions"."deep_minutes" >= 0 and "sleep_sessions"."rem_minutes" >= 0),
	CONSTRAINT "sleep_sessions_order_check" CHECK ("sleep_sessions"."sort_order" >= 0),
	CONSTRAINT "sleep_sessions_times_check" CHECK ("sleep_sessions"."ended_at" > "sleep_sessions"."started_at")
);
--> statement-breakpoint
ALTER TABLE "sleep_records" ADD COLUMN "detail_mode" text DEFAULT 'summary' NOT NULL;--> statement-breakpoint
ALTER TABLE "sleep_records" ADD COLUMN "awake_count" integer;--> statement-breakpoint
ALTER TABLE "sleep_sessions" ADD CONSTRAINT "sleep_sessions_sleep_record_id_sleep_records_id_fk" FOREIGN KEY ("sleep_record_id") REFERENCES "public"."sleep_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sleep_sessions_parent_order_index" ON "sleep_sessions" USING btree ("sleep_record_id","sort_order","started_at","id");--> statement-breakpoint
ALTER TABLE "sleep_records" ADD CONSTRAINT "sleep_records_detail_mode_check" CHECK ("sleep_records"."detail_mode" in ('summary', 'sessions'));--> statement-breakpoint
ALTER TABLE "sleep_records" ADD CONSTRAINT "sleep_records_awake_count_check" CHECK ("sleep_records"."awake_count" >= 0);