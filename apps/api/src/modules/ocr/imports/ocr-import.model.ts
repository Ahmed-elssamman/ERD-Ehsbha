import { z } from 'zod';
import type { OcrImportBatch, OcrImportImage } from '@prisma/client';
import { ocrDocumentResultSchema, ocrTripResultSchema } from '@ehsbha/api-contracts';

export interface OcrImportWithImages extends OcrImportBatch { images: OcrImportImage[] }
export interface OcrImportLease { image: OcrImportImage; batch: OcrImportBatch; token: string }
export const documentExtractionSchema = z.object({
  document: ocrDocumentResultSchema, trips: z.array(ocrTripResultSchema), meanConfidence: z.number().min(0).max(1),
}).strict();
