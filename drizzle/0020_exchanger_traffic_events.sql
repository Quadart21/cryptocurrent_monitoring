CREATE TABLE IF NOT EXISTS "exchanger_traffic_events" (
  "id" text PRIMARY KEY NOT NULL,
  "exchanger_id" text NOT NULL REFERENCES "exchangers"("id") ON DELETE CASCADE,
  "event" text NOT NULL,
  "ip" text DEFAULT '' NOT NULL,
  "user_agent" text DEFAULT '' NOT NULL,
  "path" text DEFAULT '' NOT NULL,
  "referrer" text DEFAULT '' NOT NULL,
  "created_at" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "exchanger_traffic_events_exchanger_created_idx"
  ON "exchanger_traffic_events" ("exchanger_id", "created_at");
CREATE INDEX IF NOT EXISTS "exchanger_traffic_events_created_idx"
  ON "exchanger_traffic_events" ("created_at");
CREATE INDEX IF NOT EXISTS "exchanger_traffic_events_event_idx"
  ON "exchanger_traffic_events" ("event");
