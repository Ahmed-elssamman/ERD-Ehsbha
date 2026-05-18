import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

export const UpsertReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120).optional().or(z.literal('')),
  body: z.string().trim().min(10).max(1000),
});
export type UpsertReviewDto = z.infer<typeof UpsertReviewSchema>;

export const ListReviewsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
export type ListReviewsDto = z.infer<typeof ListReviewsSchema>;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [count, agg] = await Promise.all([
      this.prisma.platformReview.count({ where: { isApproved: true } }),
      this.prisma.platformReview.aggregate({
        where: { isApproved: true },
        _avg: { rating: true },
      }),
    ]);

    const buckets = await this.prisma.platformReview.groupBy({
      by: ['rating'],
      where: { isApproved: true },
      _count: { rating: true },
    });
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const b of buckets) {
      distribution[b.rating as 1 | 2 | 3 | 4 | 5] = b._count.rating;
    }
    return {
      count,
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : 0,
      distribution,
    };
  }

  async featured(limit = 6) {
    const items = await this.prisma.platformReview.findMany({
      where: { isApproved: true, isFeatured: true },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 12),
      include: { driver: { select: { displayName: true, baseCity: true } } },
    });
    return items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      author: {
        displayName: r.driver.displayName,
        baseCity: r.driver.baseCity,
      },
    }));
  }

  async list(q: ListReviewsDto) {
    const where: Prisma.PlatformReviewWhereInput = {
      isApproved: true,
      ...(q.rating ? { rating: q.rating } : {}),
    };
    const cursor = q.cursor ? { id: q.cursor } : undefined;
    const items = await this.prisma.platformReview.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: q.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      include: { driver: { select: { id: true, displayName: true, baseCity: true } } },
    });
    const hasNext = items.length > q.limit;
    const page = hasNext ? items.slice(0, q.limit) : items;
    return {
      items: page.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        author: {
          id: r.driver.id,
          displayName: r.driver.displayName,
          baseCity: r.driver.baseCity,
        },
      })),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async getMine(driverId: string) {
    const r = await this.prisma.platformReview.findUnique({ where: { driverId } });
    if (!r) return null;
    return {
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async upsertMine(driverId: string, dto: UpsertReviewDto) {
    const title = dto.title && dto.title.length > 0 ? dto.title : null;
    try {
      const r = await this.prisma.platformReview.upsert({
        where: { driverId },
        create: {
          driverId,
          rating: dto.rating,
          title,
          body: dto.body,
        },
        update: {
          rating: dto.rating,
          title,
          body: dto.body,
        },
      });
      return {
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'REVIEW_EXISTS' });
      }
      throw e;
    }
  }

  async deleteMine(driverId: string) {
    const r = await this.prisma.platformReview.findUnique({ where: { driverId } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    await this.prisma.platformReview.delete({ where: { driverId } });
    return { ok: true };
  }
}
