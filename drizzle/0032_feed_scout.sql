CREATE TABLE "feed_scout_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"bot_token" text DEFAULT '' NOT NULL,
	"bot_username" text DEFAULT '' NOT NULL,
	"xrocket_pay_key" text DEFAULT '' NOT NULL,
	"payout_amount" double precision DEFAULT 1 NOT NULL,
	"payout_currency" text DEFAULT 'USDT' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"webhook_secret" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_scout_workers" (
	"id" text PRIMARY KEY NOT NULL,
	"tg_user_id" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_scout_workers_tg_uidx" ON "feed_scout_workers" USING btree ("tg_user_id");
--> statement-breakpoint
CREATE INDEX "feed_scout_workers_status_idx" ON "feed_scout_workers" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "feed_scout_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_url_norm" text NOT NULL,
	"exchanger_id" text,
	"pair_count" integer DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USDT' NOT NULL,
	"payout_status" text DEFAULT 'none' NOT NULL,
	"xrocket_transfer_id" text,
	"payout_error" text,
	"created_at" text NOT NULL,
	"paid_at" text
);
--> statement-breakpoint
ALTER TABLE "feed_scout_submissions" ADD CONSTRAINT "feed_scout_submissions_worker_id_feed_scout_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."feed_scout_workers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_scout_submissions_norm_uidx" ON "feed_scout_submissions" USING btree ("feed_url_norm");
--> statement-breakpoint
CREATE INDEX "feed_scout_submissions_worker_idx" ON "feed_scout_submissions" USING btree ("worker_id");
--> statement-breakpoint
CREATE INDEX "feed_scout_submissions_created_idx" ON "feed_scout_submissions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "feed_scout_submissions_payout_idx" ON "feed_scout_submissions" USING btree ("payout_status");
