ALTER TABLE "exchangers" ADD COLUMN IF NOT EXISTS "api_id" integer;
CREATE UNIQUE INDEX IF NOT EXISTS "exchangers_api_id_uidx" ON "exchangers" ("api_id");

-- Backfill stable numeric IDs for exchangers that already exist.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM exchangers
  WHERE api_id IS NULL
)
UPDATE exchangers e
SET api_id = ranked.rn
FROM ranked
WHERE e.id = ranked.id;

ALTER TABLE "email_settings"
  ADD COLUMN IF NOT EXISTS "notify_api_key_approved" boolean DEFAULT true NOT NULL;

CREATE TABLE IF NOT EXISTS "api_clients" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "website" text DEFAULT '' NOT NULL,
  "purpose" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "key_prefix" text,
  "key_hash" text,
  "rate_limit_per_sec" integer DEFAULT 10 NOT NULL,
  "last_used_at" text,
  "created_at" text NOT NULL,
  "moderated_at" text,
  "admin_note" text DEFAULT '' NOT NULL
);
CREATE INDEX IF NOT EXISTS "api_clients_status_idx" ON "api_clients" ("status");
CREATE INDEX IF NOT EXISTS "api_clients_email_idx" ON "api_clients" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "api_clients_key_hash_uidx" ON "api_clients" ("key_hash");
