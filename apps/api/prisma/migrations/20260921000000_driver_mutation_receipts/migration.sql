-- Metadata only; committed atomically with the domain write and projections.
-- Retained until account deletion so delayed device retries cannot recreate a
-- record that was subsequently corrected or removed.
CREATE TABLE "driver_mutation_receipts" (
  "driver_id" TEXT NOT NULL,
  "client_mutation_id" VARCHAR(64) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "record_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_mutation_receipts_pkey" PRIMARY KEY ("driver_id", "client_mutation_id"),
  CONSTRAINT "driver_mutation_receipts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
