ALTER TABLE "seo" ADD COLUMN "contact_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "seo" ADD COLUMN "contact_telegram" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "seo" SET "contact_email" = 'support@gapsnap.org' WHERE trim("contact_email") = '';--> statement-breakpoint
UPDATE "ad_pricing" SET "contact" = 'support@gapsnap.org' WHERE trim("contact") = '' OR "contact" = 'ads@gapsnap.local';
