CREATE TYPE "ReportPeriod" AS ENUM ('WEEKLY', 'MONTHLY');
ALTER TYPE "NotificationKind" ADD VALUE 'REPORT_READY';

CREATE TABLE "driver_reports" (
  "id" TEXT PRIMARY KEY,
  "driver_id" TEXT NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "period" "ReportPeriod" NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "captured_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "driver_reports_period_bounds" CHECK (
    ("period" = 'WEEKLY' AND EXTRACT(ISODOW FROM "starts_on") = 1 AND "ends_on" = "starts_on" + 6) OR
    ("period" = 'MONTHLY' AND "starts_on" = DATE_TRUNC('month', "starts_on")::date AND "ends_on" = ("starts_on" + INTERVAL '1 month' - INTERVAL '1 day')::date)
  ),
  CONSTRAINT "driver_reports_content_version" CHECK (("content"->>'schemaVersion')::integer = 1)
);
CREATE UNIQUE INDEX "driver_reports_driver_id_period_starts_on_key" ON "driver_reports"("driver_id", "period", "starts_on");
CREATE UNIQUE INDEX "driver_reports_driver_id_id_key" ON "driver_reports"("driver_id", "id");
CREATE INDEX "driver_reports_driver_id_created_at_id_idx" ON "driver_reports"("driver_id", "created_at" DESC, "id" DESC);

CREATE TABLE "report_revisions" (
  "id" TEXT PRIMARY KEY,
  "driver_id" TEXT NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "report_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_revisions_report_owner_fkey" FOREIGN KEY ("driver_id", "report_id") REFERENCES "driver_reports"("driver_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "report_revisions_report_id_version_key" ON "report_revisions"("report_id", "version");
CREATE INDEX "report_revisions_driver_id_report_id_created_at_id_idx" ON "report_revisions"("driver_id", "report_id", "created_at" DESC, "id" DESC);

CREATE TABLE "report_preferences" (
  "driver_id" TEXT PRIMARY KEY REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "weekly_enabled" BOOLEAN NOT NULL DEFAULT true,
  "monthly_enabled" BOOLEAN NOT NULL DEFAULT true,
  "delivery_minute" INTEGER NOT NULL DEFAULT 540,
  "quiet_enabled" BOOLEAN NOT NULL DEFAULT true,
  "quiet_start_minute" INTEGER NOT NULL DEFAULT 1380,
  "quiet_end_minute" INTEGER NOT NULL DEFAULT 420,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "report_preferences_time_bounds" CHECK (
    "delivery_minute" BETWEEN 0 AND 1439 AND "quiet_start_minute" BETWEEN 0 AND 1439 AND "quiet_end_minute" BETWEEN 0 AND 1439 AND "version" > 0
  ),
  CONSTRAINT "report_preferences_quiet_schedule" CHECK (
    NOT ("weekly_enabled" OR "monthly_enabled") OR NOT "quiet_enabled" OR
    ("quiet_start_minute" < "quiet_end_minute" AND ("delivery_minute" < "quiet_start_minute" OR "delivery_minute" >= "quiet_end_minute")) OR
    ("quiet_start_minute" > "quiet_end_minute" AND "delivery_minute" < "quiet_start_minute" AND "delivery_minute" >= "quiet_end_minute")
  )
);

-- Payment timing and linked-record exclusions match the recorded cash projections.
-- A linked payment is counted at the expense timestamp, once, even across periods.
CREATE VIEW "report_cash_ledger" AS
  SELECT e."driver_id", e."vehicle_id", e."id", e."date_time" AS "occurred_at", e."amount_piastres"::bigint AS "amount_piastres", 'EXPENSE'::text AS "kind", e."category"::text AS "category"
    FROM "expenses" e WHERE e."deleted_at" IS NULL
  UNION ALL
  SELECT f."driver_id", f."vehicle_id", f."id", f."date_time", f."total_piastres"::bigint, 'FUEL'::text, NULL::text
    FROM "fuel_logs" f WHERE f."deleted_at" IS NULL AND NOT EXISTS (SELECT 1 FROM "expenses" e WHERE e."id" = f."linked_expense_id" AND e."driver_id" = f."driver_id" AND e."deleted_at" IS NULL)
  UNION ALL
  SELECT m."driver_id", m."vehicle_id", m."id", m."performed_at", m."cost_piastres"::bigint, 'MAINTENANCE'::text, i."code"
    FROM "maintenance_records" m JOIN "maintenance_items" i ON i."id" = m."maintenance_item_id"
    WHERE m."deleted_at" IS NULL AND NOT EXISTS (SELECT 1 FROM "expenses" e WHERE e."id" = m."linked_expense_id" AND e."driver_id" = m."driver_id" AND e."deleted_at" IS NULL)
  UNION ALL
  SELECT t."driver_id", t."vehicle_id", t."id", t."started_at", t."toll_piastres"::bigint, 'TOLL'::text, NULL::text
    FROM "trips" t WHERE t."deleted_at" IS NULL AND t."toll_piastres" <> 0 AND NOT EXISTS (SELECT 1 FROM "expenses" e WHERE e."linked_trip_id" = t."id" AND e."driver_id" = t."driver_id" AND e."category" = 'TOLL' AND e."deleted_at" IS NULL)
  UNION ALL
  SELECT t."driver_id", t."vehicle_id", t."id", t."started_at", t."parking_piastres"::bigint, 'PARKING'::text, NULL::text
    FROM "trips" t WHERE t."deleted_at" IS NULL AND t."parking_piastres" <> 0 AND NOT EXISTS (SELECT 1 FROM "expenses" e WHERE e."linked_trip_id" = t."id" AND e."driver_id" = t."driver_id" AND e."category" = 'PARKING' AND e."deleted_at" IS NULL);
