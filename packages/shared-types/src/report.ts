import { addCalendarDays, businessDateKey, calendarDateValue } from './business-date';

export enum ReportPeriod { Weekly = 'WEEKLY', Monthly = 'MONTHLY' }
export enum ReportMutation { Create = 'report.create', Revise = 'report.revise', Preferences = 'report.preferences.update' }
export enum ReportCostKind { Expense = 'EXPENSE', Fuel = 'FUEL', Maintenance = 'MAINTENANCE', Toll = 'TOLL', Parking = 'PARKING' }
export enum ReportSnapshotVersion { Current = 1 }
export interface ReportPeriodRange { startsOn: string; endsOn: string; nextStartsOn: string }

/** ISO weeks and Gregorian months use Cairo date labels, never the device timezone. */
export function reportPeriodRange(period: ReportPeriod, date: string): ReportPeriodRange {
  const value = calendarDateValue(date);
  const monthStart = new Date(value);
  monthStart.setUTCDate(1);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const startsOn = period === ReportPeriod.Weekly ? addCalendarDays(date, -((value.getUTCDay() + 6) % 7))
    : monthStart.toISOString().slice(0, 10);
  const nextStartsOn = period === ReportPeriod.Weekly ? addCalendarDays(startsOn, 7)
    : nextMonth.toISOString().slice(0, 10);
  return { startsOn, nextStartsOn, endsOn: addCalendarDays(nextStartsOn, -1) };
}
export function previousReportRange(period: ReportPeriod, range: ReportPeriodRange): ReportPeriodRange {
  return reportPeriodRange(period, addCalendarDays(range.startsOn, -1));
}
export function lastCompletedReportRange(period: ReportPeriod, now: Date): ReportPeriodRange {
  return previousReportRange(period, reportPeriodRange(period, businessDateKey(now)));
}
