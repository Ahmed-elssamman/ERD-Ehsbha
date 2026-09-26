import { z } from 'zod';

export interface FinancialCoverage {
  knownGrossPiastres?: number;
  grossKnownTripCount?: number;
  commissionKnownTripCount?: number;
}

export const financialCoverageShape = {
  knownGrossPiastres: z.number().int().nonnegative().optional(),
  grossKnownTripCount: z.number().int().nonnegative().optional(),
  commissionKnownTripCount: z.number().int().nonnegative().optional(),
};
