import { clamp } from '../../../common/utils/money';

export const WORK_SCORE_VERSION = 2;

export interface ScoreInput {
  profitPerKmPiastres: number | null;
  profitPerKmMedian: number | null;
  netProfitPiastres: number | null;
  netProfitMedian: number | null;
  onlineMinutesDeviation: number | null;
}

export interface ScoreOutput {
  algorithmVersion: number;
  overall: number | null;
  efficiency: number | null;
  profit: number | null;
  consistency: number | null;
}

function relativeScore(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline === 0) return null;
  return Math.round(clamp(50 + ((value - baseline) / Math.abs(baseline)) * 50, 0, 100));
}

/** A personal work indicator; no health, fatigue, sleep, or driving-safety inference. */
export function computeDriverScore(input: ScoreInput): ScoreOutput {
  const efficiency = relativeScore(input.profitPerKmPiastres, input.profitPerKmMedian);
  const profit = relativeScore(input.netProfitPiastres, input.netProfitMedian);
  const consistency = input.onlineMinutesDeviation === null ? null
    : Math.round(clamp(100 - Math.min(60, input.onlineMinutesDeviation / 6), 0, 100));
  const overall = efficiency === null || profit === null || consistency === null ? null
    : Math.round((7 * efficiency + 5 * profit + 3 * consistency) / 15);
  return { algorithmVersion: WORK_SCORE_VERSION, overall, efficiency, profit, consistency };
}
