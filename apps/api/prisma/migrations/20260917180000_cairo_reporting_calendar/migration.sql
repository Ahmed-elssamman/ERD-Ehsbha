CREATE TYPE "ReportingCalendar" AS ENUM ('UTC', 'CAIRO');
-- Existing projections retain their old meaning until the application rebuilds
-- all affected dates/periods for a driver in one transaction.
ALTER TABLE drivers ADD COLUMN reporting_calendar "ReportingCalendar" NOT NULL DEFAULT 'UTC';
ALTER TABLE drivers ALTER COLUMN reporting_calendar SET DEFAULT 'CAIRO';
