import { z } from 'zod'

export type LifecycleStatus = 'active' | 'scaffold' | 'obsolete' | 'inactive'
export type CompatibilityClass = 'additive-compatible' | 'behaviorally-changed' | 'incompatible'
export type ConsumerRole = 'producer' | 'consumer' | 'documentation'
export type MigrationStatus = 'local' | 'migrating' | 'shared' | 'excluded'
export type ApplicationName = 'api' | 'web' | 'admin' | 'external'
export type RealmName = 'public' | 'driver' | 'admin' | 'system'
export type PaginationMode = 'cursor' | 'offset'

export interface ContractDefinition {
  id: string
  kind: 'request' | 'success-data' | 'failure' | 'event' | 'shared-value'
  schema: z.ZodTypeAny
  description: string
  compatibility: CompatibilityClass
  sinceVersion: string
  deprecatedSince: string | null
}

export interface PaginationDescriptor {
  mode: PaginationMode
  defaultSize: number
  maximumSize: number
  stableSort: string[]
  filterBinding?: boolean
  emptyPageBehavior?: string
  exceptionOwner: string | null
  exceptionReason: string | null
}

export interface IdempotencyPolicy {
  header: string
  minimumKeyLength: number
  maximumKeyLength: number
  scope: string
  retentionHours: number
}

export interface ConsumerBinding {
  application: ApplicationName
  sourcePath?: string | null
  role: ConsumerRole
  migrationStatus: MigrationStatus
  localDefinitionPaths?: string[]
  owner: string
  followUp?: string | null
}

export interface ContractCatalogEntry {
  operationId: string
  transport: 'http' | 'event'
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null
  path: string | null
  realm: RealmName
  lifecycle: LifecycleStatus
  request: Record<string, string>
  successData: string
  failureCodes: string[]
  pagination: PaginationDescriptor | null
  idempotency: IdempotencyPolicy | null
  consumers: ConsumerBinding[]
  compatibility: CompatibilityClass
  owner: string
  followUp: string | null
}
