ALTER TABLE "pap_records" ADD COLUMN "health_date" date;--> statement-breakpoint
CREATE INDEX "pap_records_health_date_index" ON "pap_records" USING btree ("health_date");