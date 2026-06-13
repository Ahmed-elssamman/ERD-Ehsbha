CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'RETRYABLE_FAILURE');

CREATE TABLE "idempotency_records" (
  "id" TEXT NOT NULL,
  "realm" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "operation_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "response_status" INTEGER,
  "response_body" JSONB,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_key_length_check"
    CHECK (char_length("key") BETWEEN 8 AND 128),
  CONSTRAINT "idempotency_records_hash_check"
    CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "idempotency_records_state_check"
    CHECK (
      ("status" = 'COMPLETED' AND "response_status" IS NOT NULL
        AND "response_body" IS NOT NULL AND "completed_at" IS NOT NULL)
      OR
      ("status" <> 'COMPLETED' AND "response_status" IS NULL
        AND "response_body" IS NULL AND "completed_at" IS NULL)
    )
);

CREATE UNIQUE INDEX "idempotency_records_realm_actor_id_operation_id_key_key"
  ON "idempotency_records"("realm", "actor_id", "operation_id", "key");
CREATE INDEX "idempotency_records_expires_at_idx"
  ON "idempotency_records"("expires_at");
CREATE INDEX "idempotency_records_actor_id_created_at_idx"
  ON "idempotency_records"("actor_id", "created_at" DESC);
