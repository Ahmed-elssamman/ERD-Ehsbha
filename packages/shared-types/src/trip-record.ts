export enum TripRecordSource { Legacy = 'LEGACY', Manual = 'MANUAL', Ocr = 'OCR', Sync = 'SYNC' }
export enum TripChange { Created = 'CREATED', Updated = 'UPDATED', Deleted = 'DELETED', Restored = 'RESTORED' }
export enum TripChangeActor { Driver = 'DRIVER', Admin = 'ADMIN' }
export enum TripView { Active = 'active', Deleted = 'deleted' }
export interface TripVersionTarget { id: string; expectedVersion: number }
