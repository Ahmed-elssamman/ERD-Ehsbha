import { MaintenanceStatus } from '@ehsbha/shared-types';

export interface RiskInput {
  currentOdoMeters: number | null;
  lastServiceOdoMeters: number | null;
  lastServiceAt: Date | null;
  intervalKm: number;
  intervalDays: number;
  now?: Date;
}
export interface RiskOutput {
  risk: number | null;
  status: MaintenanceStatus;
  kmUsage: number | null;
  timeUsage: number | null;
}

/** Ratios describe the supplied schedule, never proof that an unrecorded service did not occur. */
export function computeMaintenanceRisk(input: RiskInput): RiskOutput {
  const now = input.now ?? new Date();
  const missing: RiskOutput = { risk: null, status: MaintenanceStatus.Unknown, kmUsage: null, timeUsage: null };
  if (input.currentOdoMeters === null || !input.lastServiceAt || input.lastServiceAt > now || input.lastServiceOdoMeters === null
    || input.currentOdoMeters < input.lastServiceOdoMeters) return missing;
  const kmUsage = input.intervalKm > 0 ? (input.currentOdoMeters - input.lastServiceOdoMeters) / (input.intervalKm * 1000) : null;
  const timeUsage = input.intervalDays > 0 ? (now.getTime() - input.lastServiceAt.getTime()) / (86_400_000 * input.intervalDays) : null;
  if (kmUsage === null && timeUsage === null) return missing;
  const risk = Math.max(kmUsage ?? 0, timeUsage ?? 0);
  const status = risk > 1 ? MaintenanceStatus.Overdue : risk >= 0.95 ? MaintenanceStatus.Red : risk >= 0.7 ? MaintenanceStatus.Amber : MaintenanceStatus.Green;
  return { risk, status, kmUsage, timeUsage };
}
