ALTER TABLE "telegram_settings" ADD COLUMN "content_auto_publish" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_max_posts_per_day" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_min_interval_minutes" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_quiet_start_hour" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_quiet_end_hour" integer DEFAULT 8 NOT NULL;
