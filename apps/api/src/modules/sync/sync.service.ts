import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { FuelService, CreateFuelSchema } from '../fuel/fuel.service';
import { ExpensesService, CreateExpenseSchema } from '../expenses/expenses.service';
import { SessionsService, StartSessionSchema, EndSessionSchema } from '../sessions/sessions.service';
import { CreateTripSchema } from '../trips/dto/trips.dto';

export const PullSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type PullDto = z.infer<typeof PullSchema>;

const MutationKind = z.enum([
  'trip.create',
  'fuel.create',
  'expense.create',
  'session.start',
  'session.end',
]);

export const PushSchema = z.object({
  mutations: z
    .array(
      z.object({
        clientMutationId: z.string().min(8).max(64),
        kind: MutationKind,
        payload: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(50),
});
export type PushDto = z.infer<typeof PushSchema>;

interface MutationResult {
  clientMutationId: string;
  status: 'APPLIED' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL_ERROR';
  data?: unknown;
  error?: { code: string; message: string };
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly fuel: FuelService,
    private readonly expenses: ExpensesService,
    private readonly sessions: SessionsService,
  ) {}

  async pull(driverId: string, dto: PullDto) {
    const since = dto.cursor ? new Date(dto.cursor) : new Date(0);
    const [trips, fuels, expenses, sessions, vehicles, areas, driverApps, goals, recommendations] = await Promise.all([
      this.prisma.trip.findMany({
        where: { driverId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: dto.limit,
      }),
      this.prisma.fuelLog.findMany({
        where: { driverId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: dto.limit,
      }),
      this.prisma.expense.findMany({
        where: { driverId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: dto.limit,
      }),
      this.prisma.session.findMany({
        where: { driverId, updatedAt: { gt: since } },
        orderBy: { updatedAt: 'asc' },
        take: dto.limit,
      }),
      this.prisma.vehicle.findMany({ where: { driverId, updatedAt: { gt: since } } }),
      this.prisma.area.findMany({ where: { driverId } }),
      this.prisma.driverApp.findMany({ where: { driverId }, include: { appSource: true } }),
      this.prisma.goal.findMany({ where: { driverId, updatedAt: { gt: since } } }),
      this.prisma.recommendation.findMany({
        where: { driverId, generatedAt: { gt: since }, dismissedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { generatedAt: 'desc' },
        take: 30,
      }),
    ]);

    const newCursor = new Date().toISOString();
    return {
      cursor: newCursor,
      entities: { trips, fuels, expenses, sessions, vehicles, areas, driverApps, goals, recommendations },
    };
  }

  async push(driverId: string, dto: PushDto): Promise<{ results: MutationResult[] }> {
    const results: MutationResult[] = [];
    for (const m of dto.mutations) {
      try {
        const data = await this.applyOne(driverId, m.kind, { ...m.payload, clientMutationId: m.clientMutationId });
        results.push({ clientMutationId: m.clientMutationId, status: 'APPLIED', data });
      } catch (err: any) {
        this.logger.warn(`sync.push ${m.kind} for ${driverId} failed: ${err?.message}`);
        const code = err?.response?.code ?? err?.code ?? 'INTERNAL_ERROR';
        results.push({
          clientMutationId: m.clientMutationId,
          status: code === 'CONFLICT' ? 'CONFLICT' : 'VALIDATION_ERROR',
          error: { code, message: err?.message ?? 'Mutation failed' },
        });
      }
    }
    return { results };
  }

  private async applyOne(driverId: string, kind: string, payload: any) {
    switch (kind) {
      case 'trip.create':
        return this.trips.create(driverId, CreateTripSchema.parse(payload));
      case 'fuel.create':
        return this.fuel.create(driverId, CreateFuelSchema.parse(payload));
      case 'expense.create':
        return this.expenses.create(driverId, CreateExpenseSchema.parse(payload));
      case 'session.start':
        return this.sessions.start(driverId, StartSessionSchema.parse(payload));
      case 'session.end': {
        const parsed = z.object({
          id: z.string().min(1),
          endedAt: z.coerce.date().optional(),
        }).parse(payload);
        return this.sessions.end(driverId, parsed.id, EndSessionSchema.parse({ endedAt: parsed.endedAt }));
      }
      default:
        throw new Error(`Unknown mutation kind: ${kind}`);
    }
  }
}
