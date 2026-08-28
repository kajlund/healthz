CREATE TABLE "monthly_pap_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary_month" date NOT NULL,
	"average_usage_minutes" integer,
	"average_events_per_hour" numeric(8, 2),
	"average_mask_seal_score" numeric(10, 2),
	"average_mask_on_off_count" numeric(10, 2),
	"average_total_score" numeric(5, 2),
	"days_recorded" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_sleep_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary_month" date NOT NULL,
	"average_total_sleep_minutes" integer,
	"average_awake_minutes" integer,
	"average_light_minutes" integer,
	"average_deep_minutes" integer,
	"average_rem_minutes" integer,
	"average_sleep_score" numeric(5, 2),
	"days_recorded" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_pap_summaries_summary_month_unique" ON "monthly_pap_summaries" USING btree ("summary_month");--> statement-breakpoint
CREATE INDEX "monthly_pap_summaries_summary_month_index" ON "monthly_pap_summaries" USING btree ("summary_month");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_sleep_summaries_summary_month_unique" ON "monthly_sleep_summaries" USING btree ("summary_month");--> statement-breakpoint
CREATE INDEX "monthly_sleep_summaries_summary_month_index" ON "monthly_sleep_summaries" USING btree ("summary_month");