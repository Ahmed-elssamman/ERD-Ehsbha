import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const openApiRegistry = new OpenAPIRegistry()

export function registerSchema(name: string, schema: z.ZodTypeAny): void {
  openApiRegistry.register(name, schema as any)
}

export function registerComponentSchema(name: string, schema: z.ZodTypeAny): void {
  openApiRegistry.registerComponent('schemas', name, schema as any)
}

export function toSchemaName(operationId: string, suffix: string): string {
  return `${operationId.replace(/\./g, '_')}_${suffix}`
}

export function toRequestSchemaName(operationId: string): string {
  return toSchemaName(operationId, 'Request')
}

export function toResponseSchemaName(operationId: string): string {
  return toSchemaName(operationId, 'Response')
}
