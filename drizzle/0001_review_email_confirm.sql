ALTER TABLE "reviews" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "email_verified_at" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "confirm_token_hash" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "confirm_expires_at" text;--> statement-breakpoint
CREATE INDEX "reviews_confirm_token_hash_idx" ON "reviews" USING btree ("confirm_token_hash");