import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CommunityCategory, ReactionKind } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

const CATEGORY_VALUES = [
  'BEST_APPS',
  'EXPERIENCE_UBER',
  'EXPERIENCE_INDRIVE',
  'EXPERIENCE_DIDI',
  'EXPERIENCE_OTHER',
  'FUEL_SAVING',
  'BEST_HOURS',
  'MAINTENANCE_ADVICE',
  'EFFICIENCY_TIPS',
  'OPERATIONAL_MISTAKES',
  'WEEKLY_LESSON',
  'SAFETY_ADVICE',
  'GENERAL',
] as const;

export const ListPostsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.enum(CATEGORY_VALUES).optional(),
  sort: z.enum(['latest', 'trending', 'top']).default('latest'),
  mine: z.coerce.boolean().optional(),
});
export type ListPostsDto = z.infer<typeof ListPostsSchema>;

export const CreatePostSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
});
export type CreatePostDto = z.infer<typeof CreatePostSchema>;

export const ReactSchema = z.object({
  kind: z.enum(['LIKE', 'DISLIKE']),
});
export type ReactDto = z.infer<typeof ReactSchema>;

interface PostWithExtras {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: Date;
  updatedAt: Date;
  driver: { id: string; displayName: string; baseCity: string | null };
  reactions: { kind: ReactionKind }[];
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    return CATEGORY_VALUES.map((code) => ({ code }));
  }

  async list(driverId: string, q: ListPostsDto) {
    const where: Prisma.CommunityPostWhereInput = {
      isHidden: false,
      ...(q.category ? { category: q.category as CommunityCategory } : {}),
      ...(q.mine ? { driverId } : {}),
    };

    const orderBy: Prisma.CommunityPostOrderByWithRelationInput[] =
      q.sort === 'trending'
        ? [{ trendingScore: 'desc' }, { createdAt: 'desc' }]
        : q.sort === 'top'
          ? [{ likeCount: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

    const cursor = q.cursor ? { id: q.cursor } : undefined;
    const items = await this.prisma.communityPost.findMany({
      where,
      orderBy,
      take: q.limit + 1,
      ...(cursor ? { cursor, skip: 1 } : {}),
      include: {
        driver: { select: { id: true, displayName: true, baseCity: true } },
        reactions: {
          where: { driverId },
          select: { kind: true },
        },
      },
    });

    const hasNext = items.length > q.limit;
    const page = hasNext ? items.slice(0, q.limit) : items;

    return {
      items: page.map((p) => this.toPublic(p, driverId)),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async create(driverId: string, dto: CreatePostDto) {
    const post = await this.prisma.communityPost.create({
      data: {
        driverId,
        category: dto.category as CommunityCategory,
        title: dto.title,
        body: dto.body,
      },
      include: {
        driver: { select: { id: true, displayName: true, baseCity: true } },
        reactions: { where: { driverId }, select: { kind: true } },
      },
    });
    return this.toPublic(post, driverId);
  }

  async react(driverId: string, postId: string, dto: ReactDto) {
    const post = await this.prisma.communityPost.findFirst({
      where: { id: postId, isHidden: false },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const existing = await this.prisma.communityReaction.findUnique({
      where: { postId_driverId: { postId, driverId } },
    });

    const newKind = dto.kind as ReactionKind;

    if (existing && existing.kind === newKind) {
      // Toggle off.
      await this.prisma.$transaction([
        this.prisma.communityReaction.delete({
          where: { postId_driverId: { postId, driverId } },
        }),
        this.prisma.communityPost.update({
          where: { id: postId },
          data: {
            ...(newKind === 'LIKE' ? { likeCount: { decrement: 1 } } : { dislikeCount: { decrement: 1 } }),
          },
        }),
      ]);
    } else if (existing) {
      // Switch sides.
      await this.prisma.$transaction([
        this.prisma.communityReaction.update({
          where: { postId_driverId: { postId, driverId } },
          data: { kind: newKind },
        }),
        this.prisma.communityPost.update({
          where: { id: postId },
          data:
            newKind === 'LIKE'
              ? { likeCount: { increment: 1 }, dislikeCount: { decrement: 1 } }
              : { likeCount: { decrement: 1 }, dislikeCount: { increment: 1 } },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.communityReaction.create({
          data: { postId, driverId, kind: newKind },
        }),
        this.prisma.communityPost.update({
          where: { id: postId },
          data: newKind === 'LIKE' ? { likeCount: { increment: 1 } } : { dislikeCount: { increment: 1 } },
        }),
      ]);
    }

    // Refresh trending score.
    const updated = await this.prisma.communityPost.update({
      where: { id: postId },
      data: { trendingScore: await this.computeTrendingScore(postId) },
      include: {
        driver: { select: { id: true, displayName: true, baseCity: true } },
        reactions: { where: { driverId }, select: { kind: true } },
      },
    });
    return this.toPublic(updated, driverId);
  }

  async remove(driverId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });
    if (post.driverId !== driverId) {
      throw new ForbiddenException({ code: 'FORBIDDEN' });
    }
    await this.prisma.communityPost.delete({ where: { id: postId } });
    return { ok: true };
  }

  private async computeTrendingScore(postId: string): Promise<number> {
    const p = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      select: { likeCount: true, dislikeCount: true, createdAt: true },
    });
    if (!p) return 0;
    const ageHours = Math.max(1, (Date.now() - p.createdAt.getTime()) / 3_600_000);
    const score = p.likeCount - p.dislikeCount;
    // Hacker-news style decay.
    return score / Math.pow(ageHours + 2, 1.4);
  }

  private toPublic(p: PostWithExtras, driverId: string) {
    const my = p.reactions[0]?.kind ?? null;
    return {
      id: p.id,
      category: p.category,
      title: p.title,
      body: p.body,
      likeCount: p.likeCount,
      dislikeCount: p.dislikeCount,
      createdAt: p.createdAt.toISOString(),
      author: {
        id: p.driver.id,
        displayName: p.driver.displayName,
        baseCity: p.driver.baseCity,
      },
      myReaction: my,
      isOwn: p.driver.id === driverId,
    };
  }
}
