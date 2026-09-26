import type { Prisma } from '@prisma/client';

export const FINANCIAL_PROJECTION_VERSION = 3;
export const AGGREGATE_DAY_MS = 86_400_000;
export const AGGREGATE_TRANSACTION_TIMEOUT_MS = 15_000;
export const CALENDAR_REBUILD_TIMEOUT_MS = 120_000;
export const AGGREGATE_DRIVER_PAGE_SIZE = 100;
export const AGGREGATE_TRIP_SELECT = {
  driverAppId: true, areaId: true, startedAt: true, endedAt: true,
  grossPiastres: true, tipPiastres: true, commissionPiastres: true, tollPiastres: true, parkingPiastres: true,
  receivedPiastres: true, earningsPiastres: true,
  totalKmMeters: true, paidKmMeters: true, emptyKmMeters: true,
  linkedExpenses: { where: { deletedAt: null }, select: { category: true } },
} satisfies Prisma.TripSelect;
export const AGGREGATE_SESSION_SELECT = { driverAppId: true, startedAt: true, endedAt: true } satisfies Prisma.SessionSelect;
export const AGGREGATE_SUM_FIELDS: Prisma.DailyAggregateSumAggregateInputType = {
  tripCount: true, totalKmMeters: true, paidKmMeters: true, emptyKmMeters: true,
  grossKnownTripCount: true, commissionKnownTripCount: true,
  onlineMinutes: true, grossPiastres: true, netProfitPiastres: true,
  fuelPiastres: true, expensePiastres: true, maintenancePiastres: true, maintAmortPiastres: true,
};
