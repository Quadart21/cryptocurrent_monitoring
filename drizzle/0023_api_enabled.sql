ALTER TABLE "app_meta" ADD COLUMN IF NOT EXISTS "api_enabled" boolean DEFAULT true NOT NULL;
