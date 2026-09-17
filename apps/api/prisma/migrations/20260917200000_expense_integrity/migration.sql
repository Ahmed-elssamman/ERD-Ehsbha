CREATE TYPE "ExpenseRevisionAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'RESTORED');
ALTER TABLE expenses ADD COLUMN linked_trip_id TEXT,
  ADD COLUMN deleted_at TIMESTAMP(3), ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE expenses ADD CONSTRAINT expenses_positive_amount CHECK (amount_piastres > 0),
  ADD CONSTRAINT expenses_positive_version CHECK (version > 0),
  ADD CONSTRAINT expenses_link_fee_category CHECK (linked_trip_id IS NULL OR category IN ('TOLL', 'PARKING'));
CREATE UNIQUE INDEX trips_driver_id_id_key ON trips(driver_id, id);
ALTER TABLE expenses ADD CONSTRAINT expenses_driver_id_linked_trip_id_fkey
  FOREIGN KEY (driver_id, linked_trip_id) REFERENCES trips(driver_id, id) ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE UNIQUE INDEX expenses_active_trip_fee_key ON expenses(linked_trip_id, category)
  WHERE linked_trip_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX expenses_driver_id_deleted_at_date_time_id_idx ON expenses(driver_id, deleted_at, date_time DESC, id DESC);
CREATE TABLE expense_revisions (
  id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, expense_id TEXT NOT NULL,
  action "ExpenseRevisionAction" NOT NULL, before JSONB, after JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT expense_revisions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT expense_revisions_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX expense_revisions_driver_id_expense_id_created_at_id_idx ON expense_revisions(driver_id, expense_id, created_at DESC, id DESC);
