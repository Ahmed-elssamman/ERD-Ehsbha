import { z } from 'zod';
import { ocrTripResultSchema, type OcrTripResult } from '@ehsbha/api-contracts';
import { TripIncomeMode } from '@ehsbha/shared-types';

export interface OcrReviewCard {
  candidate: OcrTripResult; values: Record<string, string>; driverAppId: string;
  selected: boolean; expanded: boolean; saved: boolean; editedFields: string[]; failureCode: string;
  incomeMode: TripIncomeMode;
}
export interface OcrReviewDraft { cards: OcrReviewCard[]; vehicleChoice: string }
export const ocrReviewDraftSchema = z.object({
  cards: z.array(z.object({
    candidate: ocrTripResultSchema, values: z.record(z.string().max(10000)), driverAppId: z.string(),
    selected: z.boolean(), expanded: z.boolean(), saved: z.boolean(), editedFields: z.array(z.string()),
    failureCode: z.string().default(''),
    incomeMode: z.nativeEnum(TripIncomeMode).default(TripIncomeMode.Breakdown),
  }).strict()).max(200), vehicleChoice: z.string(),
}).strict();
