CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"svg" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_pricing" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"contact" text NOT NULL,
	"intro" text NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_tariffs" (
	"id" text PRIMARY KEY NOT NULL,
	"placement" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"size_label" text DEFAULT '' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"period" text DEFAULT 'week' NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"features" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"placement" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"exchanger_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" text,
	"ends_at" text,
	"created_at" text NOT NULL,
	"stats" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_global_sync_at" text,
	"seeded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "blacklist" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"reported_at" text NOT NULL,
	"reports" integer DEFAULT 1 NOT NULL,
	"exchanger_id" text
);
--> statement-breakpoint
CREATE TABLE "exchangers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"feed_url" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"rating" double precision DEFAULT 0 NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"reviews_positive" integer DEFAULT 0 NOT NULL,
	"reviews_negative" integer DEFAULT 0 NOT NULL,
	"age_years" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"approved_at" text,
	"last_sync_at" text,
	"last_error" text,
	"pair_count" integer DEFAULT 0 NOT NULL,
	"achievement_ids" text[] DEFAULT '{}' NOT NULL,
	"logo_format" text,
	"logo_updated_at" text,
	"logo_data" "bytea",
	"traffic" jsonb NOT NULL,
	"owner_login" text,
	"owner_password_hash" text,
	CONSTRAINT "exchangers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quality_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" text PRIMARY KEY NOT NULL,
	"exchanger_id" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"in_amount" double precision NOT NULL,
	"out_amount" double precision NOT NULL,
	"rate" double precision NOT NULL,
	"reserve" double precision DEFAULT 0 NOT NULL,
	"min_amount" double precision DEFAULT 0 NOT NULL,
	"max_amount" double precision DEFAULT 0 NOT NULL,
	"city" text,
	"param" text,
	"tofee" text,
	"synced_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"exchanger_id" text NOT NULL,
	"exchanger_slug" text NOT NULL,
	"exchanger_name" text NOT NULL,
	"sentiment" text NOT NULL,
	"order_id" text NOT NULL,
	"text" text NOT NULL,
	"quality_tag_ids" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL,
	"moderated_at" text,
	"owner_reply" text,
	"owner_replied_at" text
);
--> statement-breakpoint
CREATE TABLE "seo" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_name" text NOT NULL,
	"site_url" text DEFAULT '' NOT NULL,
	"title_default" text NOT NULL,
	"title_template" text NOT NULL,
	"description" text NOT NULL,
	"keywords" text DEFAULT '' NOT NULL,
	"og_title" text NOT NULL,
	"og_description" text NOT NULL,
	"og_image_url" text DEFAULT '' NOT NULL,
	"twitter_card" text NOT NULL,
	"twitter_handle" text DEFAULT '' NOT NULL,
	"robots_index" boolean DEFAULT true NOT NULL,
	"robots_follow" boolean DEFAULT true NOT NULL,
	"robots_extra" text DEFAULT '' NOT NULL,
	"robots_txt_extra" text DEFAULT '' NOT NULL,
	"sitemap_enabled" boolean DEFAULT true NOT NULL,
	"noindex_paths" text DEFAULT '' NOT NULL,
	"google_verification" text DEFAULT '' NOT NULL,
	"yandex_verification" text DEFAULT '' NOT NULL,
	"bing_verification" text DEFAULT '' NOT NULL,
	"json_ld_enabled" boolean DEFAULT true NOT NULL,
	"organization_name" text NOT NULL,
	"organization_logo_url" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_exchanger_id_exchangers_id_fk" FOREIGN KEY ("exchanger_id") REFERENCES "public"."exchangers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_exchanger_id_exchangers_id_fk" FOREIGN KEY ("exchanger_id") REFERENCES "public"."exchangers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchangers_status_idx" ON "exchangers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exchangers_owner_login_idx" ON "exchangers" USING btree ("owner_login");--> statement-breakpoint
CREATE INDEX "rates_exchanger_id_idx" ON "rates" USING btree ("exchanger_id");--> statement-breakpoint
CREATE INDEX "rates_from_to_idx" ON "rates" USING btree ("from","to");--> statement-breakpoint
CREATE INDEX "reviews_exchanger_id_idx" ON "reviews" USING btree ("exchanger_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");