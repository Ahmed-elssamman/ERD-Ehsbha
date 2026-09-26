import type { TripFinancialInput } from '@ehsbha/shared-types';
export interface WorkInterval { startedAt: Date; endedAt: Date }
export enum AggregatePeriod { Week = 'week', Month = 'month' }
export enum TripCostScope { Operating, Contribution }
export interface AggregateRepairPeriod { date: Date; period: AggregatePeriod }
export interface AggregateRepairCounts { days: number; periods: number }
export interface AggregateTrip extends WorkInterval, TripFinancialInput {
  tollLinked?: boolean; parkingLinked?: boolean;
  driverAppId: string; areaId: string | null;
  tollPiastres: number; parkingPiastres: number;
  totalKmMeters: number; paidKmMeters: number; emptyKmMeters: number;
}
export interface AggregateSession extends WorkInterval { driverAppId: string | null }
export interface AggregateTotals {
  grossKnownTripCount: number; commissionKnownTripCount: number;
  tripCount: number; totalKmMeters: bigint; paidKmMeters: bigint; emptyKmMeters: bigint;
  onlineMinutes: number; grossPiastres: bigint; tipPiastres: bigint; commissionPiastres: bigint;
  fuelPiastres: bigint; expensePiastres: bigint; maintenancePiastres: bigint; maintAmortPiastres: bigint; netProfitPiastres: bigint;
}
export interface AggregateRatios { profitPerKmPiastres: number; profitPerHourPiastres: number; emptyRatioBp: number }
export interface AggregateGroup {
  grossKnownTripCount: number; commissionKnownTripCount: number;
  tripCount: number; totalKmMeters: bigint; onlineMinutes: number; grossPiastres: bigint; netProfitPiastres: bigint;
}
