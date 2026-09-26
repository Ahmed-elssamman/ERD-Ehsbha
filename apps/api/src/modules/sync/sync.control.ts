import { SyncEntityKind } from '@ehsbha/shared-types';

// Wire order is part of cursor version 1. Changing it requires a cursor version bump.
export const SYNC_ENTITY_ORDER: SyncEntityKind[] = [
  SyncEntityKind.Trips, SyncEntityKind.Fuels, SyncEntityKind.Expenses,
  SyncEntityKind.Sessions, SyncEntityKind.Vehicles, SyncEntityKind.Areas,
  SyncEntityKind.DriverApps, SyncEntityKind.Goals, SyncEntityKind.Recommendations,
];
