ALTER TABLE "telegram_settings" ADD COLUMN "content_interval_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_max_news_per_run" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_news_lookback_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_include_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_pair_allowlist" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_pair_blocklist" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_footer" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_spread_button_text" text DEFAULT 'Смотреть курсы' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_news_button_text" text DEFAULT 'Читать статью' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_utm_campaign" text DEFAULT 'content' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_with_news_image" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_post_silent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "content_disable_preview" boolean DEFAULT true NOT NULL;
