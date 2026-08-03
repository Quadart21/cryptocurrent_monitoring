CREATE TABLE IF NOT EXISTS "mail_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "contact_email" text NOT NULL,
  "contact_name" text DEFAULT '' NOT NULL,
  "subject" text DEFAULT '' NOT NULL,
  "last_message_at" text NOT NULL,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "exchanger_id" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "direction" text NOT NULL,
  "from_address" text NOT NULL,
  "to_address" text NOT NULL,
  "subject" text DEFAULT '' NOT NULL,
  "text_body" text DEFAULT '' NOT NULL,
  "html_body" text DEFAULT '' NOT NULL,
  "resend_email_id" text,
  "message_id_header" text,
  "in_reply_to" text,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_threads_contact_idx" ON "mail_threads" ("contact_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_threads_last_msg_idx" ON "mail_threads" ("last_message_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_thread_idx" ON "mail_messages" ("thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_resend_idx" ON "mail_messages" ("resend_email_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_created_idx" ON "mail_messages" ("created_at");
