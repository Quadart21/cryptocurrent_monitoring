CREATE TABLE "telegram_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"bot_token" text DEFAULT '' NOT NULL,
	"channel_id" text DEFAULT '' NOT NULL,
	"parse_mode" text DEFAULT 'HTML' NOT NULL,
	"disable_preview" boolean DEFAULT false NOT NULL,
	"silent" boolean DEFAULT false NOT NULL,
	"bot_username" text DEFAULT '' NOT NULL,
	"channel_title" text DEFAULT '' NOT NULL,
	"last_post_at" text,
	"updated_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"chat_id" text DEFAULT '' NOT NULL,
	"message_id" integer,
	"text" text DEFAULT '' NOT NULL,
	"parse_mode" text DEFAULT 'HTML' NOT NULL,
	"disable_preview" boolean DEFAULT false NOT NULL,
	"silent" boolean DEFAULT false NOT NULL,
	"photo_url" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"admin_login" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telegram_posts_created_at_idx" ON "telegram_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "telegram_posts_status_idx" ON "telegram_posts" USING btree ("status");
