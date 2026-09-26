-- Preserve historical quantities and amounts, without inferring historical fuel kind.
ALTER TABLE drivers ALTER COLUMN financial_projection_version SET DEFAULT 3;
CREATE TYPE "FuelFillCoverage" AS ENUM ('UNCONFIRMED', 'COMPLETE', 'MISSING');
CREATE TYPE "FuelRevisionAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RESTORED');
CREATE TYPE "VehicleOdometerSource" AS ENUM ('UNKNOWN', 'LEGACY', 'MANUAL', 'FUEL', 'AMBIGUOUS');
ALTER TABLE fuel_logs RENAME COLUMN liters TO quantity;
ALTER TABLE fuel_logs RENAME COLUMN price_per_liter_piastres TO price_per_unit_piastres;
ALTER TABLE fuel_logs ALTER COLUMN quantity DROP NOT NULL,
  ALTER COLUMN price_per_unit_piastres DROP NOT NULL, ALTER COLUMN odometer_meters DROP NOT NULL,
  ADD COLUMN fuel_kind "FuelType", ADD COLUMN fill_coverage "FuelFillCoverage" NOT NULL DEFAULT 'UNCONFIRMED',
  ADD COLUMN linked_expense_id TEXT, ADD COLUMN deleted_at TIMESTAMP(3), ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fuel_logs DROP CONSTRAINT fuel_logs_vehicle_id_fkey;
ALTER TABLE fuel_logs ADD CONSTRAINT fuel_logs_driver_id_vehicle_id_fkey
  FOREIGN KEY (driver_id, vehicle_id) REFERENCES vehicles(driver_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fuel_logs_driver_id_linked_expense_id_fkey
  FOREIGN KEY (driver_id, linked_expense_id) REFERENCES expenses(driver_id, id) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT fuel_nonnegative_total CHECK (total_piastres >= 0),
  ADD CONSTRAINT fuel_positive_quantity CHECK (quantity IS NULL OR quantity > 0),
  ADD CONSTRAINT fuel_nonnegative_price CHECK (price_per_unit_piastres IS NULL OR price_per_unit_piastres >= 0),
  ADD CONSTRAINT fuel_nonnegative_odometer CHECK (odometer_meters IS NULL OR odometer_meters >= 0),
  ADD CONSTRAINT fuel_positive_version CHECK (version > 0);
CREATE UNIQUE INDEX fuel_active_expense_key ON fuel_logs(linked_expense_id) WHERE linked_expense_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX fuel_logs_driver_id_vehicle_id_deleted_at_date_time_id_idx ON fuel_logs(driver_id, vehicle_id, deleted_at, date_time DESC, id DESC);
CREATE INDEX fuel_logs_driver_id_deleted_at_date_time_id_idx ON fuel_logs(driver_id, deleted_at, date_time DESC, id DESC);
CREATE TABLE fuel_revisions (
  id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, record_id TEXT NOT NULL, version INTEGER NOT NULL,
  action "FuelRevisionAction" NOT NULL, before JSONB, after JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  CONSTRAINT fuel_revisions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fuel_revisions_record_id_fkey FOREIGN KEY (record_id) REFERENCES fuel_logs(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX fuel_revisions_record_id_version_key ON fuel_revisions(record_id, version);
CREATE INDEX fuel_revisions_driver_id_record_id_version_idx ON fuel_revisions(driver_id, record_id, version DESC);

-- An existing current value may already include an old fuel MAX. Its origin is unknown.
ALTER TABLE vehicles ADD COLUMN odometer_baseline_meters BIGINT,
  ADD COLUMN odometer_baseline_at TIMESTAMP(3),
  ADD COLUMN odometer_baseline_source "VehicleOdometerSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN odometer_source "VehicleOdometerSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN odometer_source_id TEXT, ADD COLUMN odometer_as_of TIMESTAMP(3),
  ADD COLUMN odometer_version INTEGER NOT NULL DEFAULT 1;
UPDATE vehicles SET odometer_baseline_meters = odometer_meters,
  odometer_baseline_at = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), odometer_baseline_source = 'LEGACY',
  odometer_source = 'LEGACY', odometer_as_of = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');

-- Serialize claims on the same expense across both source tables, including direct SQL writers.
CREATE FUNCTION enforce_single_operating_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.linked_expense_id IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM id FROM expenses WHERE id = NEW.linked_expense_id FOR UPDATE;
  IF TG_TABLE_NAME = 'fuel_logs' THEN
    IF EXISTS (SELECT 1 FROM maintenance_records WHERE linked_expense_id = NEW.linked_expense_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Expense already represents an active maintenance payment' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM fuel_logs WHERE linked_expense_id = NEW.linked_expense_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Expense already represents an active fuel payment' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fuel_payment_claim BEFORE INSERT OR UPDATE OF linked_expense_id, deleted_at ON fuel_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_single_operating_payment();
CREATE TRIGGER maintenance_payment_claim BEFORE INSERT OR UPDATE OF linked_expense_id, deleted_at ON maintenance_records
  FOR EACH ROW EXECUTE FUNCTION enforce_single_operating_payment();
