CREATE TABLE IF NOT EXISTS "sleep_metric_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"display_order" integer NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sleep_records" ADD COLUMN IF NOT EXISTS "measurements" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sleep_records" ADD COLUMN IF NOT EXISTS "total_scope" text DEFAULT 'legacy-all' NOT NULL;
--> statement-breakpoint
INSERT INTO sleep_metric_settings (key, enabled, display_order, sources) VALUES
('deepMinutes', true, 0, '[]'), ('lightMinutes', true, 1, '[]'),
('remMinutes', true, 2, '[]'), ('awakeMinutes', true, 3, '[]'),
('awakeCount', true, 4, '[]'), ('sleepScore', true, 5, '[]'),
('restlessMoments', false, 6, '[]'), ('restingHeartRate', false, 7, '[]'),
('bodyBatteryChange', false, 8, '[]'), ('averageSpo2', false, 9, '[]'),
('lowestSpo2', false, 10, '[]'), ('averageRespiration', false, 11, '[]'),
('lowestRespiration', false, 12, '[]')
ON CONFLICT (key) DO NOTHING;
