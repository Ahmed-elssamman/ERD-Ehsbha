import { z } from 'zod'

export enum TripPaymentMethod { Unknown = 'unknown', Cash = 'cash', Card = 'card', Wallet = 'wallet' }
export const MAX_RECORDED_WORK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
export const tripRecordIntegerSchema = z.number().int().min(0).max(2_147_483_647)
export const tripDetailsShape = {
  pickup: z.string().max(500).nullable().optional(),
  destination: z.string().max(500).nullable().optional(),
  paymentMethod: z.nativeEnum(TripPaymentMethod).optional(),
  // A breakdown of the fare, never an extra amount added to gross income.
  waitingFeePiastres: tripRecordIntegerSchema.nullable().optional(),
}
