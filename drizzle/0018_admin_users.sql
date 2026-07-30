CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" text PRIMARY KEY NOT NULL,
  "login" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text DEFAULT 'viewer' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "totp_secret" text,
  "totp_enabled" boolean DEFAULT false NOT NULL,
  "display_name" text DEFAULT '' NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "last_login_at" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_login_uidx" ON "admin_users" ("login");
CREATE INDEX IF NOT EXISTS "admin_users_role_idx" ON "admin_users" ("role");
