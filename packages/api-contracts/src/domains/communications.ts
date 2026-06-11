import { z } from 'zod'
import { registerOperation } from '../catalog/registry'
import { EmptySuccessDataSchema } from '../core/envelope'

export const communityPostSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  tags: z.array(z.string()).optional(),
}).passthrough()

export const createCommunityPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional(),
}).strict()

export const reviewSchema = z.object({
  id: z.string(),
  reviewerId: z.string(),
  targetId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  createdAt: z.string(),
}).passthrough()

export const createReviewSchema = z.object({
  targetId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
}).strict()

export const supportTicketSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum(['open', 'in-progress', 'resolved', 'closed']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  createdAt: z.string(),
}).passthrough()

export const createSupportTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
}).strict()

export const notificationSchema = z.object({
  id: z.string(),
  driverId: z.string().optional(),
  adminId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  type: z.string(),
  read: z.boolean().optional(),
  createdAt: z.string(),
}).passthrough()

export const publicReviewSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
}).passthrough()

export const dailyDigestSchema = z.object({
  date: z.string(),
  totalTrips: z.number().int().min(0),
  totalAmountPiastres: z.number().int().min(0),
  totalDistanceMeters: z.number().int().min(0),
  topReview: z.string().optional(),
}).passthrough()

registerOperation({
  operationId: 'driver.notifications.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/notifications',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'notificationSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.notifications.mark-read',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/notifications/{id}/read',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'EmptySuccessDataSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'NOT_FOUND'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/community/posts',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'communityPostSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.community.posts.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/community/posts',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createCommunityPostSchema' },
  successData: 'communityPostSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/reviews',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'reviewSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.reviews.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/reviews',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createReviewSchema' },
  successData: 'reviewSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.create',
  transport: 'http',
  method: 'POST',
  path: '/api/v1/support/tickets',
  realm: 'driver',
  lifecycle: 'active',
  request: { body: 'createSupportTicketSchema' },
  successData: 'supportTicketSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.support.tickets.list',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/support/tickets',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'supportTicketSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})

registerOperation({
  operationId: 'driver.digest.daily',
  transport: 'http',
  method: 'GET',
  path: '/api/v1/digest/daily',
  realm: 'driver',
  lifecycle: 'active',
  request: {},
  successData: 'dailyDigestSchema',
  failureCodes: ['VALIDATION_ERROR', 'UNAUTHENTICATED'],
  consumers: [{ application: 'api', role: 'producer', migrationStatus: 'shared', owner: 'platform' }],
  compatibility: 'additive-compatible',
  owner: 'platform',
  pagination: null,
  idempotency: null,
  followUp: null,
})
