ALTER TABLE "achievements" ADD COLUMN "mode" text DEFAULT 'manual' NOT NULL;
ALTER TABLE "achievements" ADD COLUMN "rule" jsonb;
