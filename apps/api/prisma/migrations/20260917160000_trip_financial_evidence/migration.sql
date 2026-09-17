ALTER TABLE trips ALTER COLUMN gross_piastres DROP NOT NULL;
ALTER TABLE trips ALTER COLUMN commission_piastres DROP NOT NULL;
ALTER TABLE trips ALTER COLUMN commission_piastres DROP DEFAULT;
ALTER TABLE trips ADD COLUMN earnings_piastres BIGINT;

-- Preserve historical recorded facts. Never reinterpret stored zero as missing.
UPDATE trips SET earnings_piastres = gross_piastres::bigint + tip_piastres::bigint - commission_piastres::bigint;

ALTER TABLE trips ADD CONSTRAINT trips_financial_evidence_check CHECK (
  (earnings_piastres IS NOT NULL OR (gross_piastres IS NOT NULL AND commission_piastres IS NOT NULL))
  AND (gross_piastres IS NULL OR gross_piastres >= 0)
  AND (commission_piastres IS NULL OR commission_piastres >= 0)
  AND (earnings_piastres IS NULL OR earnings_piastres >= tip_piastres)
  AND (gross_piastres IS NULL OR commission_piastres IS NULL OR gross_piastres >= commission_piastres)
  AND (earnings_piastres IS NULL OR gross_piastres IS NULL OR commission_piastres IS NULL
    OR earnings_piastres = gross_piastres::bigint + tip_piastres::bigint - commission_piastres::bigint)
);

ALTER TABLE daily_aggregates ADD COLUMN gross_known_trip_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN commission_known_trip_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE weekly_aggregates ADD COLUMN gross_known_trip_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN commission_known_trip_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monthly_aggregates ADD COLUMN gross_known_trip_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN commission_known_trip_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_daily_aggregates ADD COLUMN gross_known_trip_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN commission_known_trip_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE area_daily_aggregates ADD COLUMN gross_known_trip_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN commission_known_trip_count INTEGER NOT NULL DEFAULT 0;

UPDATE daily_aggregates SET gross_known_trip_count = trip_count, commission_known_trip_count = trip_count;
UPDATE weekly_aggregates SET gross_known_trip_count = trip_count, commission_known_trip_count = trip_count;
UPDATE monthly_aggregates SET gross_known_trip_count = trip_count, commission_known_trip_count = trip_count;
UPDATE app_daily_aggregates SET gross_known_trip_count = trip_count, commission_known_trip_count = trip_count;
UPDATE area_daily_aggregates SET gross_known_trip_count = trip_count, commission_known_trip_count = trip_count;
