import { safeDiv, toBp } from '../../../common/utils/money';

export interface ProfitInput {
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  fuelPiastres: number;
  expensePiastres: number;
  maintAmortPiastres: number;
  totalKmMeters: number;
  paidKmMeters: number;
  onlineMinutes: number;
}

export interface ProfitOutput {
  netProfitPiastres: number;
  profitPerKmPiastres: number;
  profitPerHourPiastres: number;
  emptyRatioBp: number;
  emptyKmMeters: number;
}

export function computeProfit(i: ProfitInput): ProfitOutput {
  const gross = i.grossPiastres + i.tipPiastres - i.commissionPiastres;
  const net = gross - i.fuelPiastres - i.expensePiastres - i.maintAmortPiastres;
  const empty = Math.max(0, i.totalKmMeters - i.paidKmMeters);
  const profitPerKm =
    i.totalKmMeters > 0 ? Math.round((net * 1000) / i.totalKmMeters) : 0;
  const profitPerHour =
    i.onlineMinutes > 0 ? Math.round((net * 60) / i.onlineMinutes) : 0;
  const emptyRatioBp = toBp(safeDiv(empty, i.totalKmMeters, 0));
  return {
    netProfitPiastres: net,
    profitPerKmPiastres: profitPerKm,
    profitPerHourPiastres: profitPerHour,
    emptyRatioBp,
    emptyKmMeters: empty,
  };
}
