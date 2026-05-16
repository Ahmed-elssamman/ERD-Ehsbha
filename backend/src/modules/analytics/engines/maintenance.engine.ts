export type MaintStatus = 'GREEN' | 'AMBER' | 'RED' | 'OVERDUE';

export interface RiskInput {
  currentOdoMeters: number;
  lastServiceOdoMeters: number;
  lastServiceAt: Date | null;
  intervalKm: number;
  intervalDays: number;
  now?: Date;
}

export interface RiskOutput {
  risk: number;
  status: MaintStatus;
  kmUsage: number;
  timeUsage: number;
}

export function computeMaintenanceRisk(i: RiskInput): RiskOutput {
  const now = i.now ?? new Date();
  const kmSinceMeters = Math.max(0, i.currentOdoMeters - i.lastServiceOdoMeters);
  const kmSinceKm = kmSinceMeters / 1000;
  const intervalKm = Math.max(1, i.intervalKm);
  const intervalDays = Math.max(1, i.intervalDays);
  const kmUsage = kmSinceKm / intervalKm;

  let timeUsage: number;
  if (i.lastServiceAt) {
    const days = Math.max(0, (now.getTime() - i.lastServiceAt.getTime()) / 86_400_000);
    timeUsage = days / intervalDays;
  } else {
    timeUsage = kmUsage;
  }

  const risk = Math.max(kmUsage, timeUsage);
  let status: MaintStatus;
  if (risk > 1) status = 'OVERDUE';
  else if (risk >= 0.95) status = 'RED';
  else if (risk >= 0.7) status = 'AMBER';
  else status = 'GREEN';

  return { risk, status, kmUsage, timeUsage };
}
