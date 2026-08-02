ALTER TABLE "legal" ADD COLUMN "terms_title" text DEFAULT 'Условия использования' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal" ADD COLUMN "terms_body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "legal" ADD COLUMN "terms_updated_at" text DEFAULT '' NOT NULL;
