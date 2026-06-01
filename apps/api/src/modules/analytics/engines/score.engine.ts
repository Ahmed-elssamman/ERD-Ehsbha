import { clamp } from '../../../common/utils/money';

export interface ScoreInput {
  profitPerKmPiastres: number;
  profitPerKmMedian: number;
  netProfitPiastres: number;
  netProfitMedian: number;
  emptyRatioBp: number;
  lateNightShare: number;
  onlineMinutesVarianceMinutes: number;
  fatigueScore: number;
}

export interface ScoreOutput {
  overall: number;
  efficiency: number;
  profit: number;
  safety: number;
  consistency: number;
}

function zToScore(value: number, median: number, scale = 0.5): number {
  if (median <= 0) return 50;
  const rel = (value - median) / median;
  return Math.round(clamp(50 + rel * 50 * scale * 2, 0, 100));
}

export function computeDriverScore(i: ScoreInput): ScoreOutput {
  const efficiency = zToScore(i.profitPerKmPiastres, i.profitPerKmMedian);
  const profit = zToScore(i.netProfitPiastres, i.netProfitMedian);

  const fatiguePenalty = Math.round(i.fatigueScore * 60);
  const lateNightPenalty = Math.round(i.lateNightShare * 30);
  const safety = Math.round(clamp(100 - fatiguePenalty - lateNightPenalty, 0, 100));

  const variancePenalty = Math.min(60, Math.round(i.onlineMinutesVarianceMinutes / 6));
  const consistency = Math.round(clamp(100 - variancePenalty, 0, 100));

  const overall = Math.round(
    0.35 * efficiency + 0.25 * profit + 0.25 * safety + 0.15 * consistency,
  );

  return { overall, efficiency, profit, safety, consistency };
}

export interface FatigueInput {
  continuousDriveMinutes: number;
  dailyOnlineMinutes: number;
  weeklyOnlineMinutes: number;
  nightShare: number;
  sleepGapHours: number;
}

export type FatigueLevel = 'SAFE' | 'TIRED' | 'HIGH';

export interface FatigueOutput {
  score: number;
  level: FatigueLevel;
}

export function computeFatigue(i: FatigueInput): FatigueOutput {
  const w1 = 0.30, w2 = 0.25, w3 = 0.15, w4 = 0.15, w5 = 0.15;
  const score = clamp(
    w1 * clamp(i.continuousDriveMinutes / 120, 0, 1) +
      w2 * clamp(i.dailyOnlineMinutes / 600, 0, 1) +
      w3 * clamp(i.weeklyOnlineMinutes / 3600, 0, 1) +
      w4 * clamp(i.nightShare, 0, 1) +
      w5 * clamp((24 - i.sleepGapHours) / 24, 0, 1),
    0,
    1,
  );
  let level: FatigueLevel = 'SAFE';
  if (score >= 0.7) level = 'HIGH';
  else if (score >= 0.4) level = 'TIRED';
  return { score, level };
}
