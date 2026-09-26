import { PrismaClient, Prisma } from '@prisma/client';
import type { AggregateRepairPeriod } from './aggregate.model';

/** Include source days and stale projection days so removed records are repaired too. */
export async function aggregateRepairDates(database: PrismaClient | Prisma.TransactionClient, driverId: string): Promise<Date[]> {
  const rows = await database.$queryRaw<Array<{ day: Date }>>`
    SELECT DISTINCT day FROM (
      SELECT generate_series(date_trunc('day', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo'), date_trunc('day', (ended_at - interval '1 millisecond') AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo'), interval '1 day') AS day
        FROM trips WHERE driver_id = ${driverId} AND deleted_at IS NULL
      UNION SELECT generate_series(date_trunc('day', started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo'), date_trunc('day', (ended_at - interval '1 millisecond') AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo'), interval '1 day')
        FROM sessions WHERE driver_id = ${driverId} AND ended_at IS NOT NULL
      UNION SELECT date_trunc('day', date_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo') FROM fuel_logs WHERE driver_id = ${driverId}
      UNION SELECT date_trunc('day', date_time AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo') FROM expenses WHERE driver_id = ${driverId} AND deleted_at IS NULL
      UNION SELECT date_trunc('day', performed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo') FROM maintenance_records WHERE driver_id = ${driverId} AND deleted_at IS NULL
      UNION SELECT date FROM daily_odometers WHERE driver_id = ${driverId}
      UNION SELECT date FROM daily_aggregates WHERE driver_id = ${driverId}
      UNION SELECT date FROM app_daily_aggregates WHERE driver_id = ${driverId}
      UNION SELECT date FROM area_daily_aggregates WHERE driver_id = ${driverId}
    ) days ORDER BY day`;
  return rows.map((row) => row.day);
}

export async function aggregateRepairPeriods(database: PrismaClient | Prisma.TransactionClient, driverId: string): Promise<AggregateRepairPeriod[]> {
  return database.$queryRaw<AggregateRepairPeriod[]>`
    SELECT make_date(year, month, 1)::timestamp AS date, 'month' AS period FROM monthly_aggregates WHERE driver_id = ${driverId}
    UNION SELECT to_date(iso_year::text || '-' || iso_week::text || '-1', 'IYYY-IW-ID')::timestamp, 'week' FROM weekly_aggregates WHERE driver_id = ${driverId}
    ORDER BY period, date`;
}
