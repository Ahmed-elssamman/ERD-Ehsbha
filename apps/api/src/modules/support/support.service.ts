import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE } from '@ehsbha/api-contracts';
import { Prisma, TicketCategory } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
// Shared support schemas available via @ehsbha/api-contracts (support schemas in communications.ts)

const CATEGORY_VALUES = ['BUG', 'FEATURE_REQUEST', 'IMPROVEMENT', 'QUESTION', 'OTHER'] as const;

export const CreateTicketSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  subject: z.string().trim().min(3).max(140),
  body: z.string().trim().min(10).max(2000),
});
export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;

/** @see {@link CursorQuerySchema} from `@ehsbha/api-contracts` for pagination shape (cursor, limit). */
export const ListTicketsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAXIMUM_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type ListTicketsDto = z.infer<typeof ListTicketsSchema>;

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a ticket is not found
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when a user tries to access another user's ticket
 * - {@link GOVERNED_ERROR_REGISTRY.VALIDATION_ERROR} - when input data fails Zod validation
 */
@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, q: ListTicketsDto) {
    const where: Prisma.SupportTicketWhereInput = { userId };
    const cursor = q.cursor ? { id: q.cursor } : undefined;
    const items = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
    });
    const hasNext = items.length > q.limit;
    const page = hasNext ? items.slice(0, q.limit) : items;
    return {
      items: page.map((t) => ({
        id: t.id,
        category: t.category,
        subject: t.subject,
        body: t.body,
        status: t.status,
        adminNote: t.adminNote,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async getMine(userId: string, id: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
    if (t.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return {
      id: t.id,
      category: t.category,
      subject: t.subject,
      body: t.body,
      status: t.status,
      adminNote: t.adminNote,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async create(userId: string, dto: CreateTicketDto) {
    const t = await this.prisma.supportTicket.create({
      data: {
        userId,
        category: dto.category as TicketCategory,
        subject: dto.subject,
        body: dto.body,
      },
    });
    return {
      id: t.id,
      category: t.category,
      subject: t.subject,
      body: t.body,
      status: t.status,
      adminNote: t.adminNote,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  async closeMine(userId: string, id: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
    if (t.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN' });
    if (t.status === 'CLOSED') return { ok: true };
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    return { ok: true };
  }
}
