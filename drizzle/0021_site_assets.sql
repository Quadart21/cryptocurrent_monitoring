CREATE TABLE IF NOT EXISTS "site_assets" (
  "kind" text PRIMARY KEY NOT NULL,
  "format" text NOT NULL,
  "updated_at" text NOT NULL,
  "data" bytea NOT NULL
);
