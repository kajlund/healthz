CREATE TABLE "healthcare_event_tags" (
	"healthcare_event_id" uuid NOT NULL,
	"healthcare_tag_id" uuid NOT NULL,
	CONSTRAINT "healthcare_event_tags_pk" PRIMARY KEY("healthcare_event_id","healthcare_tag_id")
);
--> statement-breakpoint
CREATE TABLE "healthcare_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_date" date NOT NULL,
	"event_time" time(0),
	"title" text NOT NULL,
	"description" text,
	"provider" text,
	"organization" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "healthcare_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "healthcare_event_tags" ADD CONSTRAINT "healthcare_event_tags_healthcare_event_id_healthcare_events_id_fk" FOREIGN KEY ("healthcare_event_id") REFERENCES "public"."healthcare_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "healthcare_event_tags" ADD CONSTRAINT "healthcare_event_tags_healthcare_tag_id_healthcare_tags_id_fk" FOREIGN KEY ("healthcare_tag_id") REFERENCES "public"."healthcare_tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "healthcare_event_tags_tag_index" ON "healthcare_event_tags" USING btree ("healthcare_tag_id");--> statement-breakpoint
CREATE INDEX "healthcare_events_date_index" ON "healthcare_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "healthcare_events_date_time_index" ON "healthcare_events" USING btree ("event_date","event_time");--> statement-breakpoint
CREATE UNIQUE INDEX "healthcare_tags_normalized_name_unique" ON "healthcare_tags" USING btree ("normalized_name");