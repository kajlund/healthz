CREATE TABLE "sleep_monthly_averages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"average_total_sleep_minutes" integer NOT NULL,
	"average_deep_minutes" integer NOT NULL,
	"average_light_minutes" integer NOT NULL,
	"average_rem_minutes" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sleep_monthly_averages_calendar_check" CHECK ("sleep_monthly_averages"."year" between 1900 and 9999 and "sleep_monthly_averages"."month" between 1 and 12),
	CONSTRAINT "sleep_monthly_averages_durations_check" CHECK ("sleep_monthly_averages"."average_total_sleep_minutes" between 0 and 1440 and "sleep_monthly_averages"."average_deep_minutes" between 0 and 1440 and "sleep_monthly_averages"."average_light_minutes" between 0 and 1440 and "sleep_monthly_averages"."average_rem_minutes" between 0 and 1440),
	CONSTRAINT "sleep_monthly_averages_text_check" CHECK (length(trim("sleep_monthly_averages"."source")) between 1 and 200 and length("sleep_monthly_averages"."notes") <= 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_monthly_averages_year_month_unique" ON "sleep_monthly_averages" USING btree ("year","month");