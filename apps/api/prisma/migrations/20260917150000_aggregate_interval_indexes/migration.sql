CREATE INDEX "trips_driver_id_ended_at_idx" ON "trips"("driver_id", "ended_at");
CREATE INDEX "sessions_driver_id_ended_at_idx" ON "sessions"("driver_id", "ended_at");

-- Enforce the existing one-open-session rule independently of application locks.
-- Existing duplicate open sessions must be reviewed before deploying this migration.
CREATE UNIQUE INDEX "sessions_one_open_per_driver_idx" ON "sessions"("driver_id") WHERE "ended_at" IS NULL;
