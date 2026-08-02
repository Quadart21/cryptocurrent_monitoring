ALTER TABLE "exchangers" ADD COLUMN "invite_email_sent_at" text;--> statement-breakpoint
ALTER TABLE "exchangers" ADD COLUMN "invite_email_to" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "notify_exchanger_invite" boolean DEFAULT true NOT NULL;
