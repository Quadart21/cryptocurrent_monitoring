ALTER TABLE "telegram_settings" ADD COLUMN "compose_model" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_settings" ADD COLUMN "compose_prompt" text DEFAULT '' NOT NULL;
