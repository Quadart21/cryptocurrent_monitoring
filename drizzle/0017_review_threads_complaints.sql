ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "thread_closed" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "review_replies" (
  "id" text PRIMARY KEY NOT NULL,
  "review_id" text NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "author_role" text NOT NULL,
  "body" text NOT NULL,
  "created_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "review_replies_review_id_idx" ON "review_replies" ("review_id");

CREATE TABLE IF NOT EXISTS "review_reply_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "review_id" text NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "email" text NOT NULL,
  "expires_at" text NOT NULL,
  "created_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "review_reply_tokens_hash_idx" ON "review_reply_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "review_reply_tokens_review_id_idx" ON "review_reply_tokens" ("review_id");

CREATE TABLE IF NOT EXISTS "complaints" (
  "id" text PRIMARY KEY NOT NULL,
  "exchanger_id" text NOT NULL REFERENCES "exchangers"("id") ON DELETE CASCADE,
  "exchanger_slug" text NOT NULL,
  "exchanger_name" text NOT NULL,
  "email" text NOT NULL,
  "body" text NOT NULL,
  "order_id" text DEFAULT '' NOT NULL,
  "related_review_id" text,
  "status" text DEFAULT 'awaiting_email' NOT NULL,
  "admin_note" text DEFAULT '' NOT NULL,
  "created_at" text NOT NULL,
  "moderated_at" text,
  "email_verified_at" text,
  "confirm_token_hash" text,
  "confirm_expires_at" text
);
CREATE INDEX IF NOT EXISTS "complaints_exchanger_id_idx" ON "complaints" ("exchanger_id");
CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" ("status");
CREATE INDEX IF NOT EXISTS "complaints_confirm_token_hash_idx" ON "complaints" ("confirm_token_hash");

ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "notify_review_thread_author" boolean DEFAULT true NOT NULL;
ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "notify_review_thread_owner" boolean DEFAULT true NOT NULL;
ALTER TABLE "email_settings" ADD COLUMN IF NOT EXISTS "notify_complaint_confirm" boolean DEFAULT true NOT NULL;

-- Backfill legacy single owner replies into the thread table.
INSERT INTO "review_replies" ("id", "review_id", "author_role", "body", "created_at")
SELECT
  'rr_legacy_' || "id",
  "id",
  'owner',
  "owner_reply",
  COALESCE("owner_replied_at", "created_at")
FROM "reviews"
WHERE "owner_reply" IS NOT NULL
  AND TRIM("owner_reply") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "review_replies" rr WHERE rr."review_id" = "reviews"."id"
  );
