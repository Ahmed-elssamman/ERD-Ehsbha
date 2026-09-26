-- Preserve legacy snapshots for audit, but do not expose their safety estimates.
ALTER TABLE "score_snapshots" ADD COLUMN "algorithm_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "score_snapshots" ALTER COLUMN "overall" DROP NOT NULL;
ALTER TABLE "score_snapshots" ALTER COLUMN "efficiency" DROP NOT NULL;
ALTER TABLE "score_snapshots" ALTER COLUMN "profit" DROP NOT NULL;
ALTER TABLE "score_snapshots" ALTER COLUMN "safety" DROP NOT NULL;
ALTER TABLE "score_snapshots" ALTER COLUMN "consistency" DROP NOT NULL;
DROP INDEX "score_snapshots_driver_id_date_key";
CREATE UNIQUE INDEX "score_snapshots_driver_id_date_algorithm_version_key"
  ON "score_snapshots"("driver_id", "date", "algorithm_version");
UPDATE "recommendations" SET "dismissed_at" = CURRENT_TIMESTAMP
  WHERE "type" = 'fatigue_high' AND "dismissed_at" IS NULL;
