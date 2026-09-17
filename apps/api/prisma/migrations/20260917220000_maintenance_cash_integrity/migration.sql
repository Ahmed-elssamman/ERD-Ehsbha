-- Existing projections must be rebuilt before readers can report cash costs.
ALTER TABLE drivers ADD COLUMN financial_projection_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drivers ALTER COLUMN financial_projection_version SET DEFAULT 2;
ALTER TABLE daily_aggregates ADD COLUMN maintenance_piastres BIGINT NOT NULL DEFAULT 0;
ALTER TABLE weekly_aggregates ADD COLUMN maintenance_piastres BIGINT NOT NULL DEFAULT 0;
ALTER TABLE monthly_aggregates ADD COLUMN maintenance_piastres BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX expenses_driver_id_id_key ON expenses(driver_id, id);
CREATE UNIQUE INDEX vehicles_driver_id_id_key ON vehicles(driver_id, id);
ALTER TABLE maintenance_records DROP CONSTRAINT maintenance_records_vehicle_id_fkey;
ALTER TABLE maintenance_records ADD CONSTRAINT maintenance_records_driver_id_vehicle_id_fkey
  FOREIGN KEY (driver_id, vehicle_id) REFERENCES vehicles(driver_id, id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE maintenance_records ADD COLUMN linked_expense_id TEXT,
  ADD COLUMN client_mutation_id TEXT, ADD COLUMN deleted_at TIMESTAMP(3),
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE maintenance_records ADD CONSTRAINT maintenance_nonnegative_cost CHECK (cost_piastres >= 0),
  ADD CONSTRAINT maintenance_nonnegative_odometer CHECK (odometer_meters >= 0),
  ADD CONSTRAINT maintenance_positive_version CHECK (version > 0),
  ADD CONSTRAINT maintenance_records_driver_id_linked_expense_id_fkey
    FOREIGN KEY (driver_id, linked_expense_id) REFERENCES expenses(driver_id, id) ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE UNIQUE INDEX maintenance_records_driver_id_client_mutation_id_key ON maintenance_records(driver_id, client_mutation_id);
CREATE UNIQUE INDEX maintenance_active_expense_key ON maintenance_records(linked_expense_id)
  WHERE linked_expense_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX maintenance_records_driver_id_vehicle_id_deleted_at_performed_at_id_idx
  ON maintenance_records(driver_id, vehicle_id, deleted_at, performed_at DESC, id DESC);
CREATE TYPE "MaintenanceRevisionAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RESTORED');
CREATE TABLE maintenance_revisions (
  id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, record_id TEXT NOT NULL, version INTEGER NOT NULL,
  action "MaintenanceRevisionAction" NOT NULL, before JSONB, after JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT maintenance_revisions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT maintenance_revisions_record_id_fkey FOREIGN KEY (record_id) REFERENCES maintenance_records(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX maintenance_revisions_record_id_version_key ON maintenance_revisions(record_id, version);
CREATE INDEX maintenance_revisions_driver_id_record_id_version_idx ON maintenance_revisions(driver_id, record_id, version DESC);
