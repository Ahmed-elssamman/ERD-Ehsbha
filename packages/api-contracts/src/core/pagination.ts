import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 25
export const MAXIMUM_PAGE_SIZE = 100

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type CursorQuery = z.infer<typeof CursorQuerySchema>

export const OffsetQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type OffsetQuery = z.infer<typeof OffsetQuerySchema>

export const CursorPageMetaSchema = z.object({
  mode: z.literal('cursor'),
  limit: z.number().int(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

export type CursorPageMeta = z.infer<typeof CursorPageMetaSchema>

export const OffsetPageMetaSchema = z.object({
  mode: z.literal('offset'),
  limit: z.number().int(),
  offset: z.number().int(),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
})

export type OffsetPageMeta = z.infer<typeof OffsetPageMetaSchema>

export const CursorPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: CursorPageMetaSchema,
  })

export const OffsetPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: OffsetPageMetaSchema,
  })
