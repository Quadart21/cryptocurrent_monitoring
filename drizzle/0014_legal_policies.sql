CREATE TABLE IF NOT EXISTS "legal" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"privacy_title" text NOT NULL,
	"privacy_body" text NOT NULL,
	"privacy_updated_at" text NOT NULL,
	"cookie_title" text NOT NULL,
	"cookie_body" text NOT NULL,
	"cookie_updated_at" text NOT NULL,
	"banner_title" text NOT NULL,
	"banner_body" text NOT NULL
);
