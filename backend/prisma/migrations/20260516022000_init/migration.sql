-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'BIKE');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL_80', 'PETROL_92', 'PETROL_95', 'DIESEL', 'CNG', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'INAPP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "base_city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "fuel_type" "FuelType" NOT NULL,
    "tank_liters" INTEGER NOT NULL DEFAULT 45,
    "baseline_km_per_liter" DECIMAL(6,2) NOT NULL DEFAULT 12,
    "odometer_meters" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_commission_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_apps" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "app_source_id" TEXT NOT NULL,
    "custom_name" TEXT,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_app_id" TEXT NOT NULL,
    "area_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "gross_piastres" INTEGER NOT NULL,
    "tip_piastres" INTEGER NOT NULL DEFAULT 0,
    "commission_piastres" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" INTEGER NOT NULL,
    "paid_km_meters" INTEGER NOT NULL,
    "empty_km_meters" INTEGER NOT NULL,
    "notes" TEXT,
    "client_mutation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "driver_app_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "active_minutes" INTEGER NOT NULL DEFAULT 0,
    "client_mutation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "date_time" TIMESTAMP(3) NOT NULL,
    "liters" DECIMAL(7,3) NOT NULL,
    "price_per_liter_piastres" INTEGER NOT NULL,
    "total_piastres" INTEGER NOT NULL,
    "odometer_meters" BIGINT NOT NULL,
    "is_full_tank" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "client_mutation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount_piastres" INTEGER NOT NULL,
    "date_time" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "notes" TEXT,
    "client_mutation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_interval_km" INTEGER NOT NULL,
    "default_interval_days" INTEGER NOT NULL,
    "applies_to_car" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_bike" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "maintenance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "maintenance_item_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "odometer_meters" BIGINT NOT NULL,
    "cost_piastres" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "target_piastres" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "payload" JSONB,
    "surface" TEXT NOT NULL DEFAULT 'home',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_snapshots" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "overall" INTEGER NOT NULL,
    "efficiency" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "safety" INTEGER NOT NULL,
    "consistency" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_aggregates" (
    "driver_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" BIGINT NOT NULL DEFAULT 0,
    "paid_km_meters" BIGINT NOT NULL DEFAULT 0,
    "empty_km_meters" BIGINT NOT NULL DEFAULT 0,
    "online_minutes" INTEGER NOT NULL DEFAULT 0,
    "gross_piastres" BIGINT NOT NULL DEFAULT 0,
    "tip_piastres" BIGINT NOT NULL DEFAULT 0,
    "commission_piastres" BIGINT NOT NULL DEFAULT 0,
    "fuel_piastres" BIGINT NOT NULL DEFAULT 0,
    "expense_piastres" BIGINT NOT NULL DEFAULT 0,
    "maint_amort_piastres" BIGINT NOT NULL DEFAULT 0,
    "net_profit_piastres" BIGINT NOT NULL DEFAULT 0,
    "profit_per_km_piastres" INTEGER NOT NULL DEFAULT 0,
    "profit_per_hour_piastres" INTEGER NOT NULL DEFAULT 0,
    "empty_ratio_bp" INTEGER NOT NULL DEFAULT 0,
    "fuel_km_per_liter_centi" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_aggregates_pkey" PRIMARY KEY ("driver_id","date")
);

-- CreateTable
CREATE TABLE "weekly_aggregates" (
    "driver_id" TEXT NOT NULL,
    "iso_year" INTEGER NOT NULL,
    "iso_week" INTEGER NOT NULL,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" BIGINT NOT NULL DEFAULT 0,
    "paid_km_meters" BIGINT NOT NULL DEFAULT 0,
    "empty_km_meters" BIGINT NOT NULL DEFAULT 0,
    "online_minutes" INTEGER NOT NULL DEFAULT 0,
    "gross_piastres" BIGINT NOT NULL DEFAULT 0,
    "net_profit_piastres" BIGINT NOT NULL DEFAULT 0,
    "fuel_piastres" BIGINT NOT NULL DEFAULT 0,
    "expense_piastres" BIGINT NOT NULL DEFAULT 0,
    "maint_amort_piastres" BIGINT NOT NULL DEFAULT 0,
    "profit_per_km_piastres" INTEGER NOT NULL DEFAULT 0,
    "profit_per_hour_piastres" INTEGER NOT NULL DEFAULT 0,
    "empty_ratio_bp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_aggregates_pkey" PRIMARY KEY ("driver_id","iso_year","iso_week")
);

-- CreateTable
CREATE TABLE "monthly_aggregates" (
    "driver_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" BIGINT NOT NULL DEFAULT 0,
    "paid_km_meters" BIGINT NOT NULL DEFAULT 0,
    "empty_km_meters" BIGINT NOT NULL DEFAULT 0,
    "online_minutes" INTEGER NOT NULL DEFAULT 0,
    "gross_piastres" BIGINT NOT NULL DEFAULT 0,
    "net_profit_piastres" BIGINT NOT NULL DEFAULT 0,
    "fuel_piastres" BIGINT NOT NULL DEFAULT 0,
    "expense_piastres" BIGINT NOT NULL DEFAULT 0,
    "maint_amort_piastres" BIGINT NOT NULL DEFAULT 0,
    "profit_per_km_piastres" INTEGER NOT NULL DEFAULT 0,
    "profit_per_hour_piastres" INTEGER NOT NULL DEFAULT 0,
    "empty_ratio_bp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_aggregates_pkey" PRIMARY KEY ("driver_id","year","month")
);

-- CreateTable
CREATE TABLE "app_daily_aggregates" (
    "driver_id" TEXT NOT NULL,
    "driver_app_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" BIGINT NOT NULL DEFAULT 0,
    "online_minutes" INTEGER NOT NULL DEFAULT 0,
    "gross_piastres" BIGINT NOT NULL DEFAULT 0,
    "net_profit_piastres" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_daily_aggregates_pkey" PRIMARY KEY ("driver_id","driver_app_id","date")
);

-- CreateTable
CREATE TABLE "area_daily_aggregates" (
    "driver_id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trip_count" INTEGER NOT NULL DEFAULT 0,
    "total_km_meters" BIGINT NOT NULL DEFAULT 0,
    "gross_piastres" BIGINT NOT NULL DEFAULT 0,
    "net_profit_piastres" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_daily_aggregates_pkey" PRIMARY KEY ("driver_id","area_id","date")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");

-- CreateIndex
CREATE INDEX "vehicles_driver_id_is_active_idx" ON "vehicles"("driver_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "app_sources_code_key" ON "app_sources"("code");

-- CreateIndex
CREATE INDEX "driver_apps_driver_id_idx" ON "driver_apps"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_apps_driver_id_app_source_id_custom_name_key" ON "driver_apps"("driver_id", "app_source_id", "custom_name");

-- CreateIndex
CREATE INDEX "areas_driver_id_idx" ON "areas"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_driver_id_name_key" ON "areas"("driver_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "trips_client_mutation_id_key" ON "trips"("client_mutation_id");

-- CreateIndex
CREATE INDEX "trips_driver_id_started_at_idx" ON "trips"("driver_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "trips_driver_id_driver_app_id_started_at_idx" ON "trips"("driver_id", "driver_app_id", "started_at");

-- CreateIndex
CREATE INDEX "trips_driver_id_area_id_started_at_idx" ON "trips"("driver_id", "area_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_client_mutation_id_key" ON "sessions"("client_mutation_id");

-- CreateIndex
CREATE INDEX "sessions_driver_id_started_at_idx" ON "sessions"("driver_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fuel_logs_client_mutation_id_key" ON "fuel_logs"("client_mutation_id");

-- CreateIndex
CREATE INDEX "fuel_logs_driver_id_date_time_idx" ON "fuel_logs"("driver_id", "date_time" DESC);

-- CreateIndex
CREATE INDEX "fuel_logs_vehicle_id_date_time_idx" ON "fuel_logs"("vehicle_id", "date_time");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_client_mutation_id_key" ON "expenses"("client_mutation_id");

-- CreateIndex
CREATE INDEX "expenses_driver_id_date_time_idx" ON "expenses"("driver_id", "date_time" DESC);

-- CreateIndex
CREATE INDEX "expenses_driver_id_category_idx" ON "expenses"("driver_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_items_code_key" ON "maintenance_items"("code");

-- CreateIndex
CREATE INDEX "maintenance_records_driver_id_performed_at_idx" ON "maintenance_records"("driver_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "maintenance_records_vehicle_id_maintenance_item_id_performe_idx" ON "maintenance_records"("vehicle_id", "maintenance_item_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "goals_driver_id_is_active_idx" ON "goals"("driver_id", "is_active");

-- CreateIndex
CREATE INDEX "recommendations_driver_id_surface_dismissed_at_expires_at_idx" ON "recommendations"("driver_id", "surface", "dismissed_at", "expires_at");

-- CreateIndex
CREATE INDEX "notifications_driver_id_read_at_sent_at_idx" ON "notifications"("driver_id", "read_at", "sent_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_snapshots_driver_id_date_key" ON "score_snapshots"("driver_id", "date");

-- CreateIndex
CREATE INDEX "daily_aggregates_driver_id_date_idx" ON "daily_aggregates"("driver_id", "date" DESC);

-- CreateIndex
CREATE INDEX "app_daily_aggregates_driver_id_date_idx" ON "app_daily_aggregates"("driver_id", "date");

-- CreateIndex
CREATE INDEX "area_daily_aggregates_driver_id_date_idx" ON "area_daily_aggregates"("driver_id", "date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_apps" ADD CONSTRAINT "driver_apps_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_apps" ADD CONSTRAINT "driver_apps_app_source_id_fkey" FOREIGN KEY ("app_source_id") REFERENCES "app_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_app_id_fkey" FOREIGN KEY ("driver_app_id") REFERENCES "driver_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_driver_app_id_fkey" FOREIGN KEY ("driver_app_id") REFERENCES "driver_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_maintenance_item_id_fkey" FOREIGN KEY ("maintenance_item_id") REFERENCES "maintenance_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_aggregates" ADD CONSTRAINT "daily_aggregates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_aggregates" ADD CONSTRAINT "weekly_aggregates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_aggregates" ADD CONSTRAINT "monthly_aggregates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_aggregates" ADD CONSTRAINT "app_daily_aggregates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_daily_aggregates" ADD CONSTRAINT "app_daily_aggregates_driver_app_id_fkey" FOREIGN KEY ("driver_app_id") REFERENCES "driver_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_daily_aggregates" ADD CONSTRAINT "area_daily_aggregates_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_daily_aggregates" ADD CONSTRAINT "area_daily_aggregates_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
