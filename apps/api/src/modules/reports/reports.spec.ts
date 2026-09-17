import { ReportPeriod } from '@ehsbha/shared-types';
import { CreateReportSchema, ReportListQuerySchema, UpdateReportPreferencesSchema } from '@ehsbha/api-contracts';
import { DEFAULT_REPORT_PREFERENCES, reportDeliveryDue } from './reports.control';
import { reportInteger, reportRatio, reportTotals } from './report-calculation';

describe('report money and delivery', () => {
  it('keeps unavailable ratios distinct from zero and rounds negative ties consistently', () => {
    expect(reportRatio(1n, 0n)).toBeNull();
    expect(reportRatio(0n, 60n)).toBe(0);
    expect(reportRatio(-3n, 2n)).toBe(-1);
    expect(reportRatio(-4n, 3n)).toBe(-1);
    expect(reportRatio(-5n, 3n)).toBe(-2);
    expect(() => reportInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(reportTotals([])).toMatchObject({ recordedDays: 0, netPiastres: 0, netPerHourPiastres: null, netPerKmPiastres: null });
  });
  it('checks Cairo delivery time, quiet hours and each period preference', () => {
    const prefs = DEFAULT_REPORT_PREFERENCES;
    expect(reportDeliveryDue(prefs, ReportPeriod.Weekly, new Date('2026-09-07T05:59:59Z'))).toBe(false);
    expect(reportDeliveryDue(prefs, ReportPeriod.Weekly, new Date('2026-09-07T06:00Z'))).toBe(true);
    expect(reportDeliveryDue(prefs, ReportPeriod.Weekly, new Date('2026-09-07T20:00Z'))).toBe(false);
    expect(reportDeliveryDue({ ...prefs, weeklyEnabled: false }, ReportPeriod.Weekly, new Date('2026-09-07T09:00Z'))).toBe(false);
    expect(reportDeliveryDue({ ...prefs, weeklyEnabled: false }, ReportPeriod.Monthly, new Date('2026-09-07T09:00Z'))).toBe(true);
  });
  it('rejects invalid date/extra fields, oversized pages, and impossible delivery schedules', () => {
    const id = 'ce6aaef7-28fb-400a-9df7-fc4012a6e964';
    expect(CreateReportSchema.safeParse({ period: ReportPeriod.Monthly, date: '2026-02-30', clientMutationId: id }).success).toBe(false);
    expect(CreateReportSchema.safeParse({ period: ReportPeriod.Monthly, date: '2026-02-01', clientMutationId: id, driverId: 'foreign' }).success).toBe(false);
    expect(ReportListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    const { version, ...fields } = DEFAULT_REPORT_PREFERENCES;
    expect(UpdateReportPreferencesSchema.safeParse({ ...fields, expectedVersion: version, clientMutationId: id, deliveryMinute: 1380 }).success).toBe(false);
    expect(UpdateReportPreferencesSchema.safeParse({ ...fields, expectedVersion: version, clientMutationId: id, quietStartMinute: 500, quietEndMinute: 500 }).success).toBe(false);
  });
});
