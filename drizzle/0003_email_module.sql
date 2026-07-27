CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"template_id" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"provider_raw" text
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"from_email" text DEFAULT '' NOT NULL,
	"from_name" text DEFAULT 'GapSnap' NOT NULL,
	"reply_to" text DEFAULT '' NOT NULL,
	"notify_review_confirm" boolean DEFAULT true NOT NULL,
	"notify_owner_exchanger_approved" boolean DEFAULT true NOT NULL,
	"notify_owner_review_approved" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_tag_idx" ON "email_log" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");