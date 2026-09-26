import type { DailyAggregate } from '@prisma/client';
import type { ReportTotals } from '@ehsbha/api-contracts';
import { REPORT_MONEY_FIELDS } from './reports.control';

export function reportInteger(value: bigint | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('Report value exceeds supported range');
  return result;
}
/** The existing financial projections round ties towards positive infinity. */
export function reportRatio(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) return null;
  const quotient = numerator / denominator, remainder = numerator % denominator;
  return reportInteger(quotient + (remainder * 2n >= denominator ? 1n : remainder * 2n < -denominator ? -1n : 0n));
}
export function reportDayHasActivity(row: DailyAggregate): boolean {
  return row.tripCount > 0 || row.onlineMinutes > 0 || row.totalKmMeters > 0n || row.netProfitPiastres !== 0n || row.fuelPiastres !== 0n || row.expensePiastres !== 0n || row.maintenancePiastres !== 0n;
}
export function reportTotals(rows: DailyAggregate[]): ReportTotals {
  const sums = { grossPiastres: 0n, commissionPiastres: 0n, netProfitPiastres: 0n, fuelPiastres: 0n, maintenancePiastres: 0n, expensePiastres: 0n,
    totalKmMeters: 0n, paidKmMeters: 0n, emptyKmMeters: 0n };
  let tripCount = 0, workMinutes = 0, grossKnownTripCount = 0, commissionKnownTripCount = 0, recordedDays = 0;
  for (const row of rows) {
    for (const key of REPORT_MONEY_FIELDS) sums[key] += row[key];
    tripCount += row.tripCount; workMinutes += row.onlineMinutes; grossKnownTripCount += row.grossKnownTripCount; commissionKnownTripCount += row.commissionKnownTripCount;
    if (reportDayHasActivity(row)) recordedDays++;
  }
  if (grossKnownTripCount > tripCount || commissionKnownTripCount > tripCount) throw new RangeError('Report coverage exceeds trip count');
  const costs = sums.fuelPiastres + sums.maintenancePiastres + sums.expensePiastres;
  return {
    tripCount: reportInteger(tripCount), workMinutes: reportInteger(workMinutes), grossKnownTripCount: reportInteger(grossKnownTripCount), commissionKnownTripCount: reportInteger(commissionKnownTripCount), recordedDays,
    grossPiastres: grossKnownTripCount === tripCount ? reportInteger(sums.grossPiastres) : null, knownGrossPiastres: reportInteger(sums.grossPiastres),
    commissionPiastres: commissionKnownTripCount === tripCount ? reportInteger(sums.commissionPiastres) : null, knownCommissionPiastres: reportInteger(sums.commissionPiastres),
    takeHomePiastres: reportInteger(sums.netProfitPiastres + costs), netPiastres: reportInteger(sums.netProfitPiastres), totalCostsPiastres: reportInteger(costs),
    fuelCashPiastres: reportInteger(sums.fuelPiastres), maintenanceCashPiastres: reportInteger(sums.maintenancePiastres), expenseCashPiastres: reportInteger(sums.expensePiastres),
    totalKmMeters: reportInteger(sums.totalKmMeters), paidKmMeters: reportInteger(sums.paidKmMeters), emptyKmMeters: reportInteger(sums.emptyKmMeters),
    netPerHourPiastres: reportRatio(sums.netProfitPiastres * 60n, BigInt(workMinutes)), netPerKmPiastres: reportRatio(sums.netProfitPiastres * 1000n, sums.totalKmMeters),
  };
}
