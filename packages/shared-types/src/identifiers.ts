import { Brand, brand } from './brand'

export type DriverId = Brand<string, 'DriverId'>
export type AdminId = Brand<string, 'AdminId'>
export type UserId = Brand<string, 'UserId'>
export type TripId = Brand<string, 'TripId'>
export type VehicleId = Brand<string, 'VehicleId'>
export type AreaId = Brand<string, 'AreaId'>
export type ExpenseId = Brand<string, 'ExpenseId'>
export type FuelEntryId = Brand<string, 'FuelEntryId'>
export type MaintenanceId = Brand<string, 'MaintenanceId'>
export type OdometerEntryId = Brand<string, 'OdometerEntryId'>
export type SessionId = Brand<string, 'SessionId'>
export type GoalId = Brand<string, 'GoalId'>
export type ReviewId = Brand<string, 'ReviewId'>
export type SupportTicketId = Brand<string, 'SupportTicketId'>
export type NotificationId = Brand<string, 'NotificationId'>
export type CommunityPostId = Brand<string, 'CommunityPostId'>
export type AuditRecordId = Brand<string, 'AuditRecordId'>
export type RoleId = Brand<string, 'RoleId'>
export type PermissionId = Brand<string, 'PermissionId'>
export type SettingId = Brand<string, 'SettingId'>
export type UploadId = Brand<string, 'UploadId'>
export type OcrResultId = Brand<string, 'OcrResultId'>
export type MaintenanceCatalogId = Brand<string, 'MaintenanceCatalogId'>

export function createDriverId(value: string): DriverId {
  return brand<string, 'DriverId'>(value)
}

export function createAdminId(value: string): AdminId {
  return brand<string, 'AdminId'>(value)
}

export function createUserId(value: string): UserId {
  return brand<string, 'UserId'>(value)
}

export function createTripId(value: string): TripId {
  return brand<string, 'TripId'>(value)
}

export function createVehicleId(value: string): VehicleId {
  return brand<string, 'VehicleId'>(value)
}

export function createAreaId(value: string): AreaId {
  return brand<string, 'AreaId'>(value)
}

export function createExpenseId(value: string): ExpenseId {
  return brand<string, 'ExpenseId'>(value)
}

export function createFuelEntryId(value: string): FuelEntryId {
  return brand<string, 'FuelEntryId'>(value)
}

export function createMaintenanceId(value: string): MaintenanceId {
  return brand<string, 'MaintenanceId'>(value)
}

export function createOdometerEntryId(value: string): OdometerEntryId {
  return brand<string, 'OdometerEntryId'>(value)
}

export function createSessionId(value: string): SessionId {
  return brand<string, 'SessionId'>(value)
}

export function createGoalId(value: string): GoalId {
  return brand<string, 'GoalId'>(value)
}

export function createReviewId(value: string): ReviewId {
  return brand<string, 'ReviewId'>(value)
}

export function createSupportTicketId(value: string): SupportTicketId {
  return brand<string, 'SupportTicketId'>(value)
}

export function createNotificationId(value: string): NotificationId {
  return brand<string, 'NotificationId'>(value)
}

export function createCommunityPostId(value: string): CommunityPostId {
  return brand<string, 'CommunityPostId'>(value)
}

export function createAuditRecordId(value: string): AuditRecordId {
  return brand<string, 'AuditRecordId'>(value)
}

export function createRoleId(value: string): RoleId {
  return brand<string, 'RoleId'>(value)
}

export function createPermissionId(value: string): PermissionId {
  return brand<string, 'PermissionId'>(value)
}

export function createSettingId(value: string): SettingId {
  return brand<string, 'SettingId'>(value)
}

export function createUploadId(value: string): UploadId {
  return brand<string, 'UploadId'>(value)
}

export function createOcrResultId(value: string): OcrResultId {
  return brand<string, 'OcrResultId'>(value)
}

export function createMaintenanceCatalogId(value: string): MaintenanceCatalogId {
  return brand<string, 'MaintenanceCatalogId'>(value)
}
