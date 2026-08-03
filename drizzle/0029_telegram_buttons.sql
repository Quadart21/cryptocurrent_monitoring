ALTER TABLE "telegram_posts" ADD COLUMN "buttons" jsonb DEFAULT '[]'::jsonb NOT NULL;
