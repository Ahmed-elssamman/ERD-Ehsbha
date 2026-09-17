import { describe, expect, it } from 'vitest';
import { lastCompletedReportRange, previousReportRange, reportPeriodRange, ReportPeriod } from './report';

describe('report periods use completed Cairo calendar periods', () => {
  it('uses ISO Monday weeks across a year boundary', () => {
    expect(reportPeriodRange(ReportPeriod.Weekly, '2026-01-01')).toEqual({ startsOn: '2025-12-29', endsOn: '2026-01-04', nextStartsOn: '2026-01-05' });
    expect(lastCompletedReportRange(ReportPeriod.Weekly, new Date('2026-01-04T22:00Z')).endsOn).toBe('2026-01-04');
    expect(lastCompletedReportRange(ReportPeriod.Weekly, new Date('2026-01-04T21:59:59Z')).endsOn).toBe('2025-12-28');
  });
  it('uses calendar months and leap years, not a fixed number of days', () => {
    const march = reportPeriodRange(ReportPeriod.Monthly, '2024-03-15');
    expect(previousReportRange(ReportPeriod.Monthly, march).endsOn).toBe('2024-02-29');
    expect(reportPeriodRange(ReportPeriod.Monthly, '0099-06-15').startsOn).toBe('0099-06-01');
    expect(lastCompletedReportRange(ReportPeriod.Monthly, new Date('2026-08-31T21:00Z')).endsOn).toBe('2026-08-31');
    expect(lastCompletedReportRange(ReportPeriod.Monthly, new Date('2026-08-31T20:59:59Z')).endsOn).toBe('2026-07-31');
  });
  it('keeps date ranges stable across both Cairo daylight-saving transitions', () => {
    expect(reportPeriodRange(ReportPeriod.Weekly, '2026-04-24')).toEqual({ startsOn: '2026-04-20', endsOn: '2026-04-26', nextStartsOn: '2026-04-27' });
    expect(lastCompletedReportRange(ReportPeriod.Monthly, new Date('2026-10-29T20:30Z'))).toEqual(lastCompletedReportRange(ReportPeriod.Monthly, new Date('2026-10-29T21:30Z')));
  });
});
