export enum ScoreFactor { Efficiency = 'efficiency', Profit = 'profit', Consistency = 'consistency' }
export const SCORE_FACTORS = [
  { key: ScoreFactor.Efficiency, label: 'workScore.efficiency', hint: 'workScore.efficiencyHint' },
  { key: ScoreFactor.Profit, label: 'workScore.profit', hint: 'workScore.profitHint' },
  { key: ScoreFactor.Consistency, label: 'workScore.consistency', hint: 'workScore.consistencyHint' },
];
