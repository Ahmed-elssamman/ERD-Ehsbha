CREATE TYPE "NotificationKind" AS ENUM ('GENERAL', 'DAILY_DIGEST');
CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'EVERY_THREE_DAYS', 'WEEKLY');

CREATE TABLE "notification_preferences" (
  "driver_id" TEXT PRIMARY KEY REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
  "digest_frequency" "DigestFrequency" NOT NULL DEFAULT 'DAILY',
  "delivery_minute" INTEGER NOT NULL DEFAULT 510,
  "quiet_enabled" BOOLEAN NOT NULL DEFAULT true,
  "quiet_start_minute" INTEGER NOT NULL DEFAULT 1380,
  "quiet_end_minute" INTEGER NOT NULL DEFAULT 420,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_preferences_time_bounds" CHECK (
    "delivery_minute" BETWEEN 0 AND 1439 AND "quiet_start_minute" BETWEEN 0 AND 1439 AND "quiet_end_minute" BETWEEN 0 AND 1439 AND "version" > 0
  ),
  CONSTRAINT "notification_preferences_quiet_schedule" CHECK (
    NOT "digest_enabled" OR NOT "quiet_enabled" OR
    ("quiet_start_minute" < "quiet_end_minute" AND ("delivery_minute" < "quiet_start_minute" OR "delivery_minute" >= "quiet_end_minute")) OR
    ("quiet_start_minute" > "quiet_end_minute" AND "delivery_minute" < "quiet_start_minute" AND "delivery_minute" >= "quiet_end_minute")
  )
);

ALTER TABLE "notifications" ALTER COLUMN "sent_at" TYPE TIMESTAMPTZ(3) USING "sent_at" AT TIME ZONE 'UTC';
ALTER TABLE "notifications" ALTER COLUMN "read_at" TYPE TIMESTAMPTZ(3) USING "read_at" AT TIME ZONE 'UTC';
ALTER TABLE "notifications" ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "notifications" ADD COLUMN "event_key" TEXT;
ALTER TABLE "notifications" ADD COLUMN "event_date" DATE;
UPDATE "notifications" SET "kind" = 'DAILY_DIGEST', "event_date" = ("sent_at" AT TIME ZONE 'Africa/Cairo')::date
  WHERE "data"->>'kind' = 'DAILY_DIGEST';
-- Preserve every historical notification. One original per Cairo day reserves the delivery identity.
WITH ranked AS (
  SELECT "id", "event_date", ROW_NUMBER() OVER (PARTITION BY "driver_id", "event_date" ORDER BY "sent_at", "id") AS position
  FROM "notifications" WHERE "kind" = 'DAILY_DIGEST'
)
UPDATE "notifications" AS n SET "event_key" = 'daily-digest:' || ranked."event_date"::text
  FROM ranked WHERE ranked."id" = n."id" AND ranked.position = 1;
CREATE UNIQUE INDEX "notifications_driver_id_event_key_key" ON "notifications"("driver_id", "event_key");
CREATE INDEX "notifications_driver_id_sent_at_id_idx" ON "notifications"("driver_id", "sent_at" DESC, "id" DESC);
CREATE INDEX "notifications_driver_id_kind_event_date_idx" ON "notifications"("driver_id", "kind", "event_date" DESC);
