export interface AggregateCoverageInput {
  tripCount: number | null;
  grossKnownTripCount: number | null;
  commissionKnownTripCount: number | null;
  grossPiastres: number | bigint | null;
}

export interface AggregateCoverage {
  grossPiastres: number | null;
  knownGrossPiastres: number;
  grossKnownTripCount: number;
  commissionKnownTripCount: number;
}

/** A known subtotal is never presented as complete gross revenue. */
export function aggregateCoverage(input: AggregateCoverageInput): AggregateCoverage {
  const known = input.grossKnownTripCount ?? 0;
  const total = input.tripCount ?? 0;
  const subtotal = Number(input.grossPiastres ?? 0);
  if (!Number.isSafeInteger(subtotal) || known > total) throw new RangeError('Invalid financial coverage');
  return { grossPiastres: known === total ? subtotal : null, knownGrossPiastres: subtotal,
    grossKnownTripCount: known, commissionKnownTripCount: input.commissionKnownTripCount ?? 0 };
}
