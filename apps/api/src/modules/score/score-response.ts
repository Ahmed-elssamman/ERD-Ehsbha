import { ScoreSnapshot } from '@prisma/client';

export function scoreResponse(row: ScoreSnapshot) {
  return {
    date: row.date.toISOString().slice(0, 10), algorithmVersion: row.algorithmVersion,
    overall: row.overall, efficiency: row.efficiency, profit: row.profit, consistency: row.consistency,
  };
}
