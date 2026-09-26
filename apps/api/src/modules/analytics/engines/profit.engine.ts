import { aggregateRatios, netOperatingIncome } from '../../aggregates/aggregate-calculation';

export interface ProfitInput {
  grossPiastres: number;
  tipPiastres: number;
  commissionPiastres: number;
  fuelPiastres: number;
  expensePiastres: number;
  maintenancePiastres: number;
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
  const net = netOperatingIncome({ grossPiastres: BigInt(i.grossPiastres), tipPiastres: BigInt(i.tipPiastres),
    commissionPiastres: BigInt(i.commissionPiastres), fuelPiastres: BigInt(i.fuelPiastres),
    expensePiastres: BigInt(i.expensePiastres), maintenancePiastres: BigInt(i.maintenancePiastres) });
  if (!Number.isSafeInteger(Number(net))) throw new RangeError('Net income exceeds supported range');
  const empty = Math.max(0, i.totalKmMeters - i.paidKmMeters);
  return {
    netProfitPiastres: Number(net),
    ...aggregateRatios({ netProfitPiastres: net, totalKmMeters: BigInt(i.totalKmMeters), emptyKmMeters: BigInt(empty), onlineMinutes: i.onlineMinutes }),
    emptyKmMeters: empty,
  };
}
