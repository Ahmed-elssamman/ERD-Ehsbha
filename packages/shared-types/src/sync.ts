export enum SyncEntityKind {
  Trips = 'trips',
  Fuels = 'fuels',
  Expenses = 'expenses',
  Sessions = 'sessions',
  Vehicles = 'vehicles',
  Areas = 'areas',
  DriverApps = 'driverApps',
  Goals = 'goals',
  Recommendations = 'recommendations',
}

export enum SyncPullMode {
  Reconcile = 'RECONCILE',
}

export enum SyncMutationKind {
  TripCreate = 'trip.create',
  FuelCreate = 'fuel.create',
  ExpenseCreate = 'expense.create',
  SessionStart = 'session.start',
  SessionEnd = 'session.end',
}

export enum SyncMutationStatus {
  Applied = 'APPLIED',
  ValidationError = 'VALIDATION_ERROR',
  Conflict = 'CONFLICT',
  NotFound = 'NOT_FOUND',
  Forbidden = 'FORBIDDEN',
  RetryableError = 'RETRYABLE_ERROR',
  InternalError = 'INTERNAL_ERROR',
}

export interface SyncJsonObject { [key: string]: SyncJsonValue }
export type SyncJsonValue = string | number | boolean | null | SyncJsonObject | SyncJsonValue[];
