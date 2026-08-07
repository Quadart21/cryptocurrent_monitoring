ALTER TABLE "telegram_settings" ADD COLUMN "content_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_spread_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_news_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_min_spread_pct" double precision DEFAULT 1.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_min_offers" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_max_spread_per_run" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_spread_cooldown_hours" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_last_run_at" text;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_last_run_result" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE "telegram_content_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"post_id" text,
	"error" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_content_jobs_dedupe_uidx" ON "telegram_content_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "telegram_content_jobs_status_idx" ON "telegram_content_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "telegram_content_jobs_created_at_idx" ON "telegram_content_jobs" USING btree ("created_at");
