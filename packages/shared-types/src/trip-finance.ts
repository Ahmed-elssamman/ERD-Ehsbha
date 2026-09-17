export enum TripIncomeMode { Breakdown = 'breakdown', TakeHome = 'take_home' }
export enum TripCostBasis { Contribution = 'earnings_less_trip_toll_and_parking' }

export interface TripContributionInput extends TripFinancialInput { tollPiastres: number; parkingPiastres: number }

/** Contribution keeps recorded trip fees on the trip date, before unallocated operating costs. */
export function tripContributionPiastres(input: TripContributionInput): number {
  const contribution = BigInt(tripEarningsPiastres(input)) - BigInt(input.tollPiastres) - BigInt(input.parkingPiastres);
  const result = Number(contribution);
  if (!Number.isSafeInteger(result)) throw new RangeError('Trip contribution exceeds safe integer precision');
  return result;
}

export interface TripFinancialInput {
  grossPiastres: number | null;
  commissionPiastres: number | null;
  tipPiastres: number;
  receivedPiastres?: number | null;
  /** Total driver earnings after platform deductions, including recorded tips. */
  earningsPiastres?: number | bigint | null;
}

export interface TripFinancialValues {
  grossPiastres: number | null;
  commissionPiastres: number | null;
  receivedPiastres: number;
  tipPiastres: number;
  earningsPiastres: number;
}

/** Resolve only arithmetic implied by supplied facts; never guess a platform fee. */
export function resolveTripFinancials(input: TripFinancialInput): TripFinancialValues | null {
  let gross = input.grossPiastres;
  let commission = input.commissionPiastres;
  let received = input.receivedPiastres ?? null;
  let earnings = input.earningsPiastres == null ? null : Number(input.earningsPiastres);
  const values = [gross, commission, received, earnings, input.tipPiastres];
  if (values.some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0))) return null;
  if (earnings !== null) {
    const fareAfterCommission = earnings - input.tipPiastres;
    if (fareAfterCommission < 0 || (received !== null && received !== fareAfterCommission)) return null;
    received = fareAfterCommission;
  }
  if (received === null && gross !== null && commission !== null) received = gross - commission;
  if (received === null || received < 0) return null;
  if (gross === null && commission !== null) gross = received + commission;
  if (commission === null && gross !== null) commission = gross - received;
  if (gross !== null && commission !== null && (commission < 0 || gross - commission !== received)) return null;
  earnings ??= received + input.tipPiastres;
  if (!Number.isSafeInteger(earnings) || (gross !== null && !Number.isSafeInteger(gross))) return null;
  return { grossPiastres: gross, commissionPiastres: commission, receivedPiastres: received,
    tipPiastres: input.tipPiastres, earningsPiastres: earnings };
}

/** Validated source records always resolve; callers must handle invalid history. */
export function tripEarningsPiastres(input: TripFinancialInput): number {
  const values = resolveTripFinancials(input);
  if (!values) throw new RangeError('Inconsistent trip financial evidence');
  return values.earningsPiastres;
}
