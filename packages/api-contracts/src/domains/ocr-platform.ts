import { z } from 'zod'

export const ocrPlatformSchema = z.enum(['UBER', 'INDRIVE', 'DIDI', 'CAREEM'])
export type OcrPlatform = z.infer<typeof ocrPlatformSchema>
