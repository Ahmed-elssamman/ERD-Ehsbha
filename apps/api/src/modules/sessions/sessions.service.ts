import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';
import { diffMinutes } from '../../common/utils/date';

export const StartSessionSchema = z.object({
  driverAppId: z.string().min(1),
  startedAt: z.coerce.date().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
});
export type StartSessionDto = z.infer<typeof StartSessionSchema>;

export const EndSessionSchema = z.object({
  endedAt: z.coerce.date().optional(),
});
export type EndSessionDto = z.infer<typeof EndSessionSchema>;

export const ListSessionsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListSessionsDto = z.infer<typeof ListSessionsSchema>;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) {}

  async list(driverId: string, q: ListSessionsDto) {
    const where: any = { driverId };
    if (q.from || q.to) {
      where.startedAt = {};
      if (q.from) where.startedAt.gte = q.from;
      if (q.to) where.startedAt.lte = q.to;
    }
    return this.prisma.session.findMany({ where, orderBy: { startedAt: 'desc' }, take: 100 });
  }

  async getOpen(driverId: string) {
    return this.prisma.session.findFirst({
      where: { driverId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  async start(driverId: string, dto: StartSessionDto) {
    if (dto.clientMutationId) {
      const dup = await this.prisma.session.findUnique({ where: { clientMutationId: dto.clientMutationId } });
      if (dup) return dup;
    }
    const open = await this.getOpen(driverId);
    if (open) throw new ConflictException({ code: 'SESSION_ALREADY_OPEN', message: 'End the open session first' });
    return this.prisma.session.create({
      data: {
        driverId,
        driverAppId: dto.driverAppId,
        startedAt: dto.startedAt ?? new Date(),
        clientMutationId: dto.clientMutationId ?? null,
      },
    });
  }

  async end(driverId: string, id: string, dto: EndSessionDto) {
    const s = await this.prisma.session.findFirst({ where: { id, driverId } });
    if (!s) throw new NotFoundException({ code: 'SESSION_NOT_FOUND' });
    if (s.endedAt) throw new ConflictException({ code: 'SESSION_ALREADY_ENDED' });

    const endedAt = dto.endedAt ?? new Date();
    const activeMinutes = diffMinutes(s.startedAt, endedAt);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: { id },
        data: { endedAt, activeMinutes },
      });
      await this.aggregates.applySession({
        driverId,
        driverAppId: s.driverAppId,
        startedAt: s.startedAt,
        endedAt,
        activeMinutes,
        sign: 1,
      }, tx);
      return updated;
    });
  }
}
