import { z } from 'zod';
import { CreateTripSchema, UpdateTripSchema, BatchCreateTripsSchema, BatchDeleteTripsSchema, ListTripsSchema } from '@ehsbha/api-contracts';

export { CreateTripSchema, UpdateTripSchema, BatchCreateTripsSchema, BatchDeleteTripsSchema, ListTripsSchema };
export { tripSchema as TripResponseSchema } from '@ehsbha/api-contracts';
export type CreateTripDto = z.infer<typeof CreateTripSchema>;
export type UpdateTripDto = z.infer<typeof UpdateTripSchema>;
export type BatchCreateTripsDto = z.infer<typeof BatchCreateTripsSchema>;
export type BatchDeleteTripsDto = z.infer<typeof BatchDeleteTripsSchema>;
export type ListTripsDto = z.infer<typeof ListTripsSchema>;
