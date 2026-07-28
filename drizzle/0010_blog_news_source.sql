ALTER TABLE "blog_posts" ADD COLUMN "source_provider" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_source_id_uidx" ON "blog_posts" USING btree ("source_id");--> statement-breakpoint
CREATE TABLE "news_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"rewrite_prompt" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" text,
	"last_sync_result" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT '' NOT NULL
);
