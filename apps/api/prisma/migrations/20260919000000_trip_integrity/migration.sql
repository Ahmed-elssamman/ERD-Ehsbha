CREATE TYPE "TripRecordSource" AS ENUM ('LEGACY', 'MANUAL', 'OCR', 'SYNC');
CREATE TYPE "TripRevisionAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RESTORED');
CREATE TYPE "TripRevisionActor" AS ENUM ('DRIVER', 'ADMIN');

ALTER TABLE trips ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN source "TripRecordSource" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE trips ADD CONSTRAINT trips_positive_version CHECK (version > 0);
UPDATE trips SET source = 'OCR' WHERE EXISTS (
  SELECT 1 FROM ocr_trip_confirmations confirmation WHERE confirmation.trip_id = trips.id
);
CREATE INDEX trips_driver_id_deleted_at_started_at_id_idx ON trips(driver_id, deleted_at, started_at DESC, id DESC);

CREATE TABLE trip_revisions (
  id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, record_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0), action "TripRevisionAction" NOT NULL,
  actor "TripRevisionActor" NOT NULL, before JSONB, after JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT trip_revisions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT trip_revisions_record_id_fkey FOREIGN KEY (record_id) REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX trip_revisions_record_id_version_key ON trip_revisions(record_id, version);
CREATE INDEX trip_revisions_driver_id_record_id_version_idx ON trip_revisions(driver_id, record_id, version DESC);
