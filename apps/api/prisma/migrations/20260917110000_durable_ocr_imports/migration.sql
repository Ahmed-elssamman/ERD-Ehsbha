-- CreateEnum
CREATE TYPE "OcrImportImageState" AS ENUM ('awaiting_upload', 'queued', 'processing', 'completed', 'failed', 'duplicate');

-- CreateTable
CREATE TABLE "ocr_import_batches" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "client_mutation_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "hints" JSONB NOT NULL,
    "result" JSONB,
    "cancelled_at" TIMESTAMP(3),
    "upload_expires_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_import_images" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "image_hash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" "OcrImportImageState" NOT NULL DEFAULT 'awaiting_upload',
    "duplicate_of" TEXT,
    "reserved_bytes" INTEGER NOT NULL DEFAULT 0,
    "payload" BYTEA,
    "extraction" JSONB,
    "error_code" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" TEXT,
    "lease_until" TIMESTAMP(3),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_import_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_import_batches_driver_id_created_at_id_idx" ON "ocr_import_batches"("driver_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ocr_import_batches_expires_at_idx" ON "ocr_import_batches"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_import_batches_driver_id_client_mutation_id_key" ON "ocr_import_batches"("driver_id", "client_mutation_id");

-- CreateIndex
CREATE INDEX "ocr_import_images_status_available_at_created_at_idx" ON "ocr_import_images"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "ocr_import_images_lease_until_idx" ON "ocr_import_images"("lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_import_images_batch_id_index_key" ON "ocr_import_images"("batch_id", "index");

-- AddForeignKey
ALTER TABLE "ocr_import_batches" ADD CONSTRAINT "ocr_import_batches_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_import_images" ADD CONSTRAINT "ocr_import_images_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ocr_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
