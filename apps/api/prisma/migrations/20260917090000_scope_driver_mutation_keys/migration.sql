BEGIN;

-- Create tenant-scoped constraints before removing global ones.
-- Existing mutation IDs and records remain unchanged. NULL keys stay optional.
CREATE UNIQUE INDEX "trips_driver_id_client_mutation_id_key" ON "trips"("driver_id", "client_mutation_id");
CREATE UNIQUE INDEX "fuel_logs_driver_id_client_mutation_id_key" ON "fuel_logs"("driver_id", "client_mutation_id");
CREATE UNIQUE INDEX "expenses_driver_id_client_mutation_id_key" ON "expenses"("driver_id", "client_mutation_id");
CREATE UNIQUE INDEX "sessions_driver_id_client_mutation_id_key" ON "sessions"("driver_id", "client_mutation_id");

DROP INDEX "trips_client_mutation_id_key";
DROP INDEX "fuel_logs_client_mutation_id_key";
DROP INDEX "expenses_client_mutation_id_key";
DROP INDEX "sessions_client_mutation_id_key";

COMMIT;
