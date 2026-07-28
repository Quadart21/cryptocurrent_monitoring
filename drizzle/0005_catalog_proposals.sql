CREATE TABLE "catalog_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discovered_at" text NOT NULL,
	"moderated_at" text
);
--> statement-breakpoint
CREATE INDEX "catalog_proposals_status_idx" ON "catalog_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catalog_proposals_kind_code_idx" ON "catalog_proposals" USING btree ("kind","code");
