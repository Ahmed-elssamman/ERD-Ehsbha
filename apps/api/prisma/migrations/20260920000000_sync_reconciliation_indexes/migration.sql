-- Stable owner-scoped keyset scans. Trips, expenses and vehicles already have
-- a unique (driver_id, id) index. No source data or financial history is changed.
CREATE INDEX "fuel_logs_driver_id_id_idx" ON "fuel_logs"("driver_id", "id");
CREATE INDEX "sessions_driver_id_id_idx" ON "sessions"("driver_id", "id");
CREATE INDEX "areas_driver_id_id_idx" ON "areas"("driver_id", "id");
CREATE INDEX "driver_apps_driver_id_id_idx" ON "driver_apps"("driver_id", "id");
CREATE INDEX "goals_driver_id_id_idx" ON "goals"("driver_id", "id");
CREATE INDEX "recommendations_driver_id_id_idx" ON "recommendations"("driver_id", "id");
