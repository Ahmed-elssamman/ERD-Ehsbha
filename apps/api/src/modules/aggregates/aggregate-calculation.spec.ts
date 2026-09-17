import { aggregateRatios, dailyTotals, workMinutes } from './aggregate-calculation';
import type { AggregateTrip } from './aggregate.model';

const from = new Date('2026-09-14T00:00:00Z');
const to = new Date('2026-09-15T00:00:00Z');
function interval(start: string, end: string) { return { startedAt: new Date(start), endedAt: new Date(end) }; }

describe('financial projections', () => {
  it('unions nested, adjacent and overlapping work intervals without mutating the source', () => {
    const periods = [interval('2026-09-14T09:00Z', '2026-09-14T10:00Z'), interval('2026-09-14T08:00Z', '2026-09-14T09:30Z'), interval('2026-09-14T08:10Z', '2026-09-14T08:20Z')];
    const original = periods.map((period) => period.startedAt.getTime());
    expect(workMinutes(periods, from, to)).toBe(120);
    expect(periods.map((period) => period.startedAt.getTime())).toEqual(original);
  });
  it('clips cross-midnight work and ignores invalid/empty intervals', () => {
    expect(workMinutes([interval('2026-09-13T23:50Z', '2026-09-14T00:20Z'), interval('2026-09-14T23:50Z', '2026-09-15T00:30Z'), interval('2026-09-14T09:00Z', '2026-09-14T08:00Z')], from, to)).toBe(30);
  });
  it('includes tips and trip costs, while assigning fare/distance only to the start date', () => {
    const trip: AggregateTrip = { ...interval('2026-09-13T23:50Z', '2026-09-14T00:20Z'), driverAppId: 'a', areaId: null,
      grossPiastres: 10000, tipPiastres: 500, commissionPiastres: 2000, tollPiastres: 300, parkingPiastres: 200,
      totalKmMeters: 10000, paidKmMeters: 8000, emptyKmMeters: 2000 };
    const first = dailyTotals([trip], [], new Date('2026-09-13T00:00Z'), from, 1000n, 200n, 100n);
    expect(first.netProfitPiastres).toBe(6700n);
    expect(first.expensePiastres).toBe(700n);
    const second = dailyTotals([trip], [], from, to, 0n, 0n, 0n);
    expect(second).toMatchObject({ tripCount: 0, grossPiastres: 0n, totalKmMeters: 0n, onlineMinutes: 20 });
  });
  it('rounds negative ratios exactly and handles zero denominators', () => {
    expect(aggregateRatios({ netProfitPiastres: -1n, totalKmMeters: 2000n, emptyKmMeters: 0n, onlineMinutes: 120 })).toEqual({ profitPerKmPiastres: 0, profitPerHourPiastres: 0, emptyRatioBp: 0 });
    expect(aggregateRatios({ netProfitPiastres: -5n, totalKmMeters: 2000n, emptyKmMeters: 1000n, onlineMinutes: 0 })).toEqual({ profitPerKmPiastres: -2, profitPerHourPiastres: 0, emptyRatioBp: 5000 });
    expect(() => aggregateRatios({ netProfitPiastres: 9007199254740993n, totalKmMeters: 1n, emptyKmMeters: 0n, onlineMinutes: 1 })).toThrow(RangeError);
  });
});
