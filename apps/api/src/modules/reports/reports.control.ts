import { businessHour, DRIVER_TIME_ZONE, ReportPeriod } from '@ehsbha/shared-types';
import type { ReportPreferences } from '@ehsbha/api-contracts';

export const REPORT_SCAN_SIZE = 100;
export const REPORT_GROUP_LIMIT = 200;
export const REPORT_LARGEST_COST_LIMIT = 10;
export const REPORT_SUMMARY_SELECT = { id: true, period: true, startsOn: true, endsOn: true, version: true, capturedAt: true, createdAt: true } as const;
export const REPORT_PERIODS = [ReportPeriod.Weekly, ReportPeriod.Monthly];
export const DEFAULT_REPORT_PREFERENCES: ReportPreferences = {
  version: 0, weeklyEnabled: true, monthlyEnabled: true, deliveryMinute: 540,
  quietEnabled: true, quietStartMinute: 1380, quietEndMinute: 420,
};
export const REPORT_MONEY_FIELDS = ['grossPiastres', 'commissionPiastres', 'netProfitPiastres', 'fuelPiastres', 'maintenancePiastres', 'expensePiastres', 'totalKmMeters', 'paidKmMeters', 'emptyKmMeters'] as const;
export function reportEventKey(period: ReportPeriod, startsOn: string): string { return `report-ready:${period}:${startsOn}`; }
export function reportDeliveryDue(settings: ReportPreferences, period: ReportPeriod, now: Date): boolean {
  if (period === ReportPeriod.Weekly ? !settings.weeklyEnabled : !settings.monthlyEnabled) return false;
  const minute = businessHour(now) * 60 + Number(new Intl.DateTimeFormat('en', { timeZone: DRIVER_TIME_ZONE, minute: 'numeric' }).format(now));
  if (minute < settings.deliveryMinute) return false;
  if (!settings.quietEnabled) return true;
  const start = settings.quietStartMinute, end = settings.quietEndMinute;
  return start < end ? minute < start || minute >= end : start > end && minute < start && minute >= end;
}
