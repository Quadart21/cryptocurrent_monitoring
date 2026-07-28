ALTER TABLE "news_settings" ADD COLUMN "sync_progress" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_settings" ADD COLUMN "sync_started_at" text;
