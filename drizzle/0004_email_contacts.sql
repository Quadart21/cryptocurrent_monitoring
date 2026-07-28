CREATE TABLE "email_contacts" (
	"email" text PRIMARY KEY NOT NULL,
	"sources" text[] DEFAULT '{}' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"exchanger_ids" text[] DEFAULT '{}' NOT NULL,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_contacts_unsubscribed_idx" ON "email_contacts" USING btree ("unsubscribed");
