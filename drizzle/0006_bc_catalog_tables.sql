CREATE TABLE "bc_groups" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bc_countries" (
	"code" text PRIMARY KEY NOT NULL,
	"id" integer NOT NULL,
	"name" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"rank" integer DEFAULT 9999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bc_cities" (
	"code" text PRIMARY KEY NOT NULL,
	"id" integer NOT NULL,
	"name" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"country_id" integer,
	"country_code" text DEFAULT '' NOT NULL,
	"country_name" text DEFAULT '' NOT NULL,
	"rank" integer DEFAULT 9999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bc_currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"id" integer NOT NULL,
	"name" text NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"viewname" text DEFAULT '' NOT NULL,
	"urlname" text DEFAULT '' NOT NULL,
	"crypto" boolean DEFAULT false NOT NULL,
	"cash" boolean DEFAULT false NOT NULL,
	"group_id" integer DEFAULT 0 NOT NULL,
	"ps" integer DEFAULT 0 NOT NULL,
	"defamt" double precision DEFAULT 0 NOT NULL,
	"bigamt" double precision DEFAULT 0 NOT NULL,
	"rank" integer DEFAULT 9999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bc_catalog_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"fetched_at" text,
	"updated_at" text NOT NULL,
	"source" text DEFAULT 'db' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bc_cities_country_code_idx" ON "bc_cities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "bc_currencies_cash_idx" ON "bc_currencies" USING btree ("cash");--> statement-breakpoint
CREATE INDEX "bc_currencies_group_id_idx" ON "bc_currencies" USING btree ("group_id");
