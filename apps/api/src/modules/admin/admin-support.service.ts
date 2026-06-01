import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus, TicketCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(
    cursor: string | undefined,
    limit: number,
    status?: TicketStatus,
    category?: TicketCategory,
  ) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    };
    const items = await this.prisma.supportTicket.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, phone: true, email: true } },
      },
    });
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map((t) => ({
        id: t.id,
        userId: t.userId,
        userPhone: t.user.phone,
        userEmail: t.user.email,
        category: t.category,
        subject: t.subject,
        body: t.body.slice(0, 200),
        status: t.status,
        adminNote: t.adminNote,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async get(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { id: true, phone: true, email: true, status: true } } },
    });
    if (!t) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
    return t;
  }

  async transition(actor: AuthenticatedAdmin, id: string, status: TicketStatus, reason?: string) {
    const before = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true, subject: true },
    });
    if (!before) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
    const after = await this.prisma.supportTicket.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, subject: true },
    });
    await this.audit.record({
      actor,
      action: 'support.transition',
      targetType: 'SupportTicket',
      targetId: id,
      before,
      after,
      reason,
    });
    return after;
  }

  async setNote(actor: AuthenticatedAdmin, id: string, adminNote: string) {
    const before = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, adminNote: true },
    });
    if (!before) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
    const after = await this.prisma.supportTicket.update({
      where: { id },
      data: { adminNote },
      select: { id: true, adminNote: true },
    });
    await this.audit.record({
      actor,
      action: 'support.reply',
      targetType: 'SupportTicket',
      targetId: id,
      before,
      after,
    });
    return after;
  }

  async summary() {
    const [open, inReview, planned, resolved, closed, byCategory] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.supportTicket.count({ where: { status: 'PLANNED' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
      this.prisma.supportTicket.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);
    return {
      byStatus: { open, inReview, planned, resolved, closed },
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
    };
  }
}
