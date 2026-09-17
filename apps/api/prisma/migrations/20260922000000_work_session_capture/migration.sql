ALTER TABLE "sessions" ALTER COLUMN "driver_app_id" DROP NOT NULL;
ALTER TABLE "sessions" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
DROP INDEX "sessions_one_open_per_driver_idx";
CREATE UNIQUE INDEX "sessions_one_open_per_driver_idx" ON "sessions"("driver_id") WHERE "ended_at" IS NULL AND "deleted_at" IS NULL;
CREATE INDEX "sessions_driver_id_started_at_id_idx" ON "sessions"("driver_id", "started_at" DESC, "id" DESC);
CREATE TYPE "SessionRevisionAction" AS ENUM ('STARTED', 'CREATED', 'ENDED', 'CORRECTED', 'DELETED', 'RESTORED');
CREATE TABLE "session_revisions" (
  "id" TEXT NOT NULL,
  "driver_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "action" "SessionRevisionAction" NOT NULL,
  "before" JSONB,
  "after" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_revisions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "session_revisions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "session_revisions_driver_id_session_id_created_at_id_idx" ON "session_revisions"("driver_id", "session_id", "created_at" DESC, "id" DESC);
