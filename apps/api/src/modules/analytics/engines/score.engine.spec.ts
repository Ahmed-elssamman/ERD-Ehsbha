import { computeDriverScore } from './score.engine';

const baseline = { profitPerKmPiastres: 100, profitPerKmMedian: 100, netProfitPiastres: 1000, netProfitMedian: 1000, onlineMinutesDeviation: 0 };
describe('work score', () => {
  it('has no score when observations are missing or the financial baseline is zero', () => {
    expect(computeDriverScore({ ...baseline, profitPerKmMedian: null }).overall).toBeNull();
    expect(computeDriverScore({ ...baseline, netProfitMedian: 0 }).profit).toBeNull();
    expect(computeDriverScore({ ...baseline, onlineMinutesDeviation: null }).overall).toBeNull();
  });
  it('uses the documented weights and contains no health or safety dimension', () => {
    expect(computeDriverScore(baseline)).toEqual({ algorithmVersion: 2, overall: 60, efficiency: 50, profit: 50, consistency: 100 });
  });
  it('treats reduced losses as improvement and caps extremes', () => {
    expect(computeDriverScore({ ...baseline, netProfitMedian: -1000, netProfitPiastres: -500 }).profit).toBe(75);
    expect(computeDriverScore({ ...baseline, profitPerKmPiastres: -10000 }).efficiency).toBe(0);
    expect(computeDriverScore({ ...baseline, profitPerKmPiastres: 10000 }).efficiency).toBe(100);
  });
});
