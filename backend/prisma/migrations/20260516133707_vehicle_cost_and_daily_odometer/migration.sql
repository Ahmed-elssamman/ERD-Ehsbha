-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "parking_piastres" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "received_piastres" INTEGER,
ADD COLUMN     "toll_piastres" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "battery_cost_piastres" INTEGER,
ADD COLUMN     "battery_interval_months" INTEGER,
ADD COLUMN     "brakes_cost_piastres" INTEGER,
ADD COLUMN     "brakes_interval_km" INTEGER,
ADD COLUMN     "chain_cost_piastres" INTEGER,
ADD COLUMN     "chain_interval_km" INTEGER,
ADD COLUMN     "fuel_tank_cost_piastres" INTEGER,
ADD COLUMN     "fuel_tank_km_range" INTEGER,
ADD COLUMN     "monthly_avg_km" INTEGER,
ADD COLUMN     "monthly_maint_cost_piastres" INTEGER,
ADD COLUMN     "oil_cost_piastres" INTEGER,
ADD COLUMN     "oil_interval_km" INTEGER,
ADD COLUMN     "tire_cost_piastres" INTEGER,
ADD COLUMN     "tire_interval_km" INTEGER;

-- CreateTable
CREATE TABLE "daily_odometers" (
    "driver_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_km_meters" BIGINT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_odometers_pkey" PRIMARY KEY ("driver_id","date")
);

-- AddForeignKey
ALTER TABLE "daily_odometers" ADD CONSTRAINT "daily_odometers_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
