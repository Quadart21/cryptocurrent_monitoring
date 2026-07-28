ALTER TABLE "news_settings" ADD COLUMN "proxy_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "news_settings" ADD COLUMN "proxy_user" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_settings" ADD COLUMN "proxy_pass" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_settings" ADD COLUMN "proxy_port" integer DEFAULT 7165 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_settings" ADD COLUMN "proxy_hosts" text DEFAULT '' NOT NULL;
