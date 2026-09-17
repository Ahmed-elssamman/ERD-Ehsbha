import { Prisma } from '@prisma/client';
import { businessDay, type ReportCostKind, type ReportPeriodRange } from '@ehsbha/shared-types';
import { reportCostSchema, type ReportCost, type ReportVehicleCost } from '@ehsbha/api-contracts';
import { REPORT_GROUP_LIMIT, REPORT_LARGEST_COST_LIMIT } from './reports.control';
import { reportInteger } from './report-calculation';

interface CashGroup { vehicleId: string; fuel: bigint; maintenance: bigint; expenses: bigint; fees: bigint; total: bigint; count: bigint }
interface CashCost { id: string; kind: ReportCostKind; date: string; amountPiastres: bigint; category: string | null; vehicleId: string | null }
export interface ReportCashDetail { vehicleCosts: ReportVehicleCost[] | null; unassignedCostsPiastres: number; largestCosts: ReportCost[]; totalPiastres: number }

/** UTC-naive source columns are compared to explicit UTC bounds, independently of SQL session timezone. */
export async function readReportCash(database: Prisma.TransactionClient, driverId: string, range: ReportPeriodRange): Promise<ReportCashDetail> {
  const from = businessDay(range.startsOn).start.toISOString(), to = businessDay(range.nextStartsOn).start.toISOString();
  const where = Prisma.sql`driver_id = ${driverId} AND occurred_at >= (${from}::timestamptz AT TIME ZONE 'UTC') AND occurred_at < (${to}::timestamptz AT TIME ZONE 'UTC')`;
  const [groups, totals, largest] = await Promise.all([
    database.$queryRaw<CashGroup[]>(Prisma.sql`SELECT vehicle_id AS "vehicleId", COALESCE(SUM(amount_piastres) FILTER (WHERE kind = 'FUEL'), 0)::bigint AS fuel,
      COALESCE(SUM(amount_piastres) FILTER (WHERE kind = 'MAINTENANCE'), 0)::bigint AS maintenance,
      COALESCE(SUM(amount_piastres) FILTER (WHERE kind = 'EXPENSE'), 0)::bigint AS expenses,
      COALESCE(SUM(amount_piastres) FILTER (WHERE kind IN ('TOLL','PARKING')), 0)::bigint AS fees,
      SUM(amount_piastres)::bigint AS total, COUNT(*)::bigint AS count FROM report_cash_ledger WHERE ${where} AND vehicle_id IS NOT NULL
      GROUP BY vehicle_id ORDER BY vehicle_id LIMIT ${REPORT_GROUP_LIMIT + 1}`),
    database.$queryRaw<Array<{ unassigned: bigint; total: bigint }>>(Prisma.sql`SELECT COALESCE(SUM(amount_piastres) FILTER (WHERE vehicle_id IS NULL), 0)::bigint AS unassigned,
      COALESCE(SUM(amount_piastres), 0)::bigint AS total FROM report_cash_ledger WHERE ${where}`),
    database.$queryRaw<CashCost[]>(Prisma.sql`SELECT id, kind, TO_CHAR((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS date,
      amount_piastres AS "amountPiastres", category, vehicle_id AS "vehicleId" FROM report_cash_ledger WHERE ${where} AND amount_piastres > 0
      ORDER BY amount_piastres DESC, occurred_at DESC, kind ASC, id ASC LIMIT ${REPORT_LARGEST_COST_LIMIT}`),
  ]);
  const vehicles = groups.length <= REPORT_GROUP_LIMIT ? await database.vehicle.findMany({ where: { driverId, id: { in: groups.map((row) => row.vehicleId) } }, select: { id: true, make: true, model: true, type: true } }) : [];
  const names = new Map(vehicles.map((vehicle) => [vehicle.id, [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.type]));
  const vehicleCosts = groups.length > REPORT_GROUP_LIMIT ? null : groups.map((row) => {
    const name = names.get(row.vehicleId);
    if (!name) throw new RangeError('Report vehicle does not belong to the driver');
    return { id: row.vehicleId, name, fuelPiastres: reportInteger(row.fuel), maintenancePiastres: reportInteger(row.maintenance),
      expensesPiastres: reportInteger(row.expenses), tripFeesPiastres: reportInteger(row.fees), totalPiastres: reportInteger(row.total), recordCount: reportInteger(row.count) };
  });
  return { vehicleCosts, unassignedCostsPiastres: reportInteger(totals[0]?.unassigned ?? 0n), totalPiastres: reportInteger(totals[0]?.total ?? 0n),
    largestCosts: largest.map((row) => reportCostSchema.parse({ ...row, amountPiastres: reportInteger(row.amountPiastres) })) };
}
