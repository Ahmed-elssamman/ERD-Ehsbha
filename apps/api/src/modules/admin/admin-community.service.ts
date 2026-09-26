import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when a community post is not found
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_PERMISSIONS_STALE} - when admin permissions are stale
 * - {@link GOVERNED_ERROR_REGISTRY.ADMIN_MFA_REQUIRED} - when MFA verification is required for this action
 * - {@link GOVERNED_ERROR_REGISTRY.SESSION_EXPIRED} - when the admin session has expired
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when admin lacks permission for the action
 */
@Injectable()
export class AdminCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async listPosts(cursor: string | undefined, limit: number, isHidden?: boolean) {
    const where: Prisma.CommunityPostWhereInput = {
      ...(typeof isHidden === 'boolean' ? { isHidden } : {}),
    };
    const items = await this.prisma.communityPost.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { driver: { include: { user: { select: { phone: true } } } } },
    });
    const hasNext = items.length > limit;
    const page = hasNext ? items.slice(0, limit) : items;
    return {
      items: page.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body.slice(0, 200),
        category: p.category,
        likeCount: p.likeCount,
        dislikeCount: p.dislikeCount,
        trendingScore: p.trendingScore,
        isHidden: p.isHidden,
        driverId: p.driverId,
        driverDisplayName: p.driver.displayName,
        driverPhone: p.driver.user.phone,
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async getPost(id: string) {
    const p = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        driver: { include: { user: { select: { phone: true, email: true } } } },
        reactions: { take: 25, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw new NotFoundException({ code: 'POST_NOT_FOUND' });
    return p;
  }

  async setHidden(actor: AuthenticatedAdmin, id: string, isHidden: boolean) {
    const before = await this.prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, isHidden: true, title: true },
    });
    if (!before) throw new NotFoundException({ code: 'POST_NOT_FOUND' });
    const after = await this.prisma.communityPost.update({
      where: { id },
      data: { isHidden },
      select: { id: true, isHidden: true, title: true },
    });
    await this.audit.record({
      actor,
      action: isHidden ? 'community.hide' : 'community.unhide',
      targetType: 'CommunityPost',
      targetId: id,
      before,
      after,
    });
    return after;
  }

  async delete(actor: AuthenticatedAdmin, id: string, reason: string) {
    const before = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'POST_NOT_FOUND' });
    await this.prisma.communityPost.delete({ where: { id } });
    await this.audit.record({
      actor,
      action: 'community.delete',
      targetType: 'CommunityPost',
      targetId: id,
      before,
      after: null,
      reason,
    });
    return { ok: true };
  }
}
