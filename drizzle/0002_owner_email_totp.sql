ALTER TABLE "exchangers" ADD COLUMN "owner_email" text;--> statement-breakpoint
ALTER TABLE "exchangers" ADD COLUMN "owner_totp_secret" text;--> statement-breakpoint
ALTER TABLE "exchangers" ADD COLUMN "owner_totp_enabled" boolean DEFAULT false NOT NULL;