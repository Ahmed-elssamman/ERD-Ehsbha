-- CreateEnum
CREATE TYPE "TripPaymentMethod" AS ENUM ('unknown', 'cash', 'card', 'wallet');

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "destination" TEXT,
ADD COLUMN     "payment_method" "TripPaymentMethod" NOT NULL DEFAULT 'unknown',
ADD COLUMN     "pickup" TEXT,
ADD COLUMN     "waiting_fee_piastres" INTEGER;

-- CreateTable
CREATE TABLE "ocr_trip_confirmations" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "candidate_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "original_trip_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "original" JSONB NOT NULL,
    "confirmed" JSONB NOT NULL,
    "corrected_fields" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_trip_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_trip_confirmations_batch_id_idx" ON "ocr_trip_confirmations"("batch_id");

-- CreateIndex
CREATE INDEX "ocr_trip_confirmations_trip_id_idx" ON "ocr_trip_confirmations"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_trip_confirmations_driver_id_candidate_id_key" ON "ocr_trip_confirmations"("driver_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "ocr_trip_confirmations" ADD CONSTRAINT "ocr_trip_confirmations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_trip_confirmations" ADD CONSTRAINT "ocr_trip_confirmations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ocr_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_trip_confirmations" ADD CONSTRAINT "ocr_trip_confirmations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
