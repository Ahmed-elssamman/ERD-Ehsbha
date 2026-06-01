import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(cursor: string | undefined, limit: number, isApproved?: boolean, isFeatured?: boolean) {
    const where: Prisma.PlatformReviewWhereInput = {
      ...(typeof isApproved === 'boolean' ? { isApproved } : {}),
      ...(typeof isFeatured === 'boolean' ? { isFeatured } : {}),
    };
    const items = await this.prisma.platformReview.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: { select: { phone: true } } } } },
    });
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        isApproved: r.isApproved,
        isFeatured: r.isFeatured,
        driverId: r.driverId,
        driverDisplayName: r.driver.displayName,
        driverPhone: r.driver.user.phone,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async setApproved(actor: AuthenticatedAdmin, id: string, isApproved: boolean) {
    const before = await this.prisma.platformReview.findUnique({ where: { id }, select: { id: true, isApproved: true, isFeatured: true } });
    if (!before) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    const after = await this.prisma.platformReview.update({
      where: { id },
      data: { isApproved },
      select: { id: true, isApproved: true, isFeatured: true },
    });
    await this.audit.record({
      actor,
      action: isApproved ? 'reviews.approve' : 'reviews.unapprove',
      targetType: 'PlatformReview',
      targetId: id,
      before,
      after,
    });
    return after;
  }

  async setFeatured(actor: AuthenticatedAdmin, id: string, isFeatured: boolean) {
    const before = await this.prisma.platformReview.findUnique({ where: { id }, select: { id: true, isApproved: true, isFeatured: true } });
    if (!before) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    const after = await this.prisma.platformReview.update({
      where: { id },
      data: { isFeatured },
      select: { id: true, isApproved: true, isFeatured: true },
    });
    await this.audit.record({
      actor,
      action: isFeatured ? 'reviews.feature' : 'reviews.unfeature',
      targetType: 'PlatformReview',
      targetId: id,
      before,
      after,
    });
    return after;
  }

  async delete(actor: AuthenticatedAdmin, id: string, reason: string) {
    const before = await this.prisma.platformReview.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    await this.prisma.platformReview.delete({ where: { id } });
    await this.audit.record({
      actor,
      action: 'reviews.delete',
      targetType: 'PlatformReview',
      targetId: id,
      before,
      after: null,
      reason,
    });
    return { ok: true };
  }

  async summary() {
    const [total, approved, featured, avgRating, byRating] = await Promise.all([
      this.prisma.platformReview.count(),
      this.prisma.platformReview.count({ where: { isApproved: true } }),
      this.prisma.platformReview.count({ where: { isFeatured: true } }),
      this.prisma.platformReview.aggregate({ where: { isApproved: true }, _avg: { rating: true } }),
      this.prisma.platformReview.groupBy({
        by: ['rating'],
        where: { isApproved: true },
        _count: { _all: true },
      }),
    ]);
    return {
      total,
      approved,
      featured,
      pending: total - approved,
      avgRating: avgRating._avg.rating ?? 0,
      distribution: byRating.map((b) => ({ rating: b.rating, count: b._count._all })),
    };
  }
}
