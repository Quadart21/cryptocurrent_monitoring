ALTER TABLE "telegram_posts" ADD COLUMN "topic" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_posts" ADD COLUMN "progress" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_posts" ADD COLUMN "with_image" boolean DEFAULT false NOT NULL;
