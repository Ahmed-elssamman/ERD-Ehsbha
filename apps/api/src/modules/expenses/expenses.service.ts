import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { AggregatesService } from '../aggregates/aggregates.service';

const Category = z.enum(['RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER']);

export const CreateExpenseSchema = z.object({
  vehicleId: z.string().min(1).nullable().optional(),
  category: Category,
  amountPiastres: z.number().int().min(1),
  dateTime: z.coerce.date(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  clientMutationId: z.string().min(8).max(64).optional(),
});
export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;

export const UpdateExpenseSchema = CreateExpenseSchema.partial();
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseSchema>;

export const ListExpensesSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: Category.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListExpensesDto = z.infer<typeof ListExpensesSchema>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: AggregatesService,
  ) {}

  list(driverId: string, q: ListExpensesDto) {
    const where: any = { driverId };
    if (q.from || q.to) {
      where.dateTime = {};
      if (q.from) where.dateTime.gte = q.from;
      if (q.to) where.dateTime.lte = q.to;
    }
    if (q.category) where.category = q.category;
    return this.prisma.expense.findMany({ where, orderBy: { dateTime: 'desc' }, take: q.limit });
  }

  async create(driverId: string, dto: CreateExpenseDto) {
    if (dto.clientMutationId) {
      const dup = await this.prisma.expense.findUnique({ where: { clientMutationId: dto.clientMutationId } });
      if (dup) return dup;
    }
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          driverId,
          vehicleId: dto.vehicleId ?? null,
          category: dto.category,
          amountPiastres: dto.amountPiastres,
          dateTime: dto.dateTime,
          isRecurring: dto.isRecurring,
          recurrenceRule: dto.recurrenceRule ?? null,
          notes: dto.notes ?? null,
          clientMutationId: dto.clientMutationId ?? null,
        },
      });
      await this.aggregates.applyExpense({
        driverId,
        dateTime: created.dateTime,
        amountPiastres: created.amountPiastres,
        sign: 1,
      }, tx);
      return created;
    });
  }

  async update(driverId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findFirst({ where: { id, driverId } });
    if (!existing) throw new NotFoundException({ code: 'EXPENSE_NOT_FOUND' });
    return this.prisma.$transaction(async (tx) => {
      await this.aggregates.applyExpense({
        driverId,
        dateTime: existing.dateTime,
        amountPiastres: existing.amountPiastres,
        sign: -1,
      }, tx);
      const updated = await tx.expense.update({
        where: { id },
        data: {
          vehicleId: dto.vehicleId === undefined ? undefined : dto.vehicleId,
          category: dto.category ?? undefined,
          amountPiastres: dto.amountPiastres ?? undefined,
          dateTime: dto.dateTime ?? undefined,
          isRecurring: dto.isRecurring ?? undefined,
          recurrenceRule: dto.recurrenceRule === undefined ? undefined : dto.recurrenceRule,
          notes: dto.notes === undefined ? undefined : dto.notes,
        },
      });
      await this.aggregates.applyExpense({
        driverId,
        dateTime: updated.dateTime,
        amountPiastres: updated.amountPiastres,
        sign: 1,
      }, tx);
      return updated;
    });
  }

  async remove(driverId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({ where: { id, driverId } });
    if (!existing) throw new NotFoundException({ code: 'EXPENSE_NOT_FOUND' });
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await this.aggregates.applyExpense({
        driverId,
        dateTime: existing.dateTime,
        amountPiastres: existing.amountPiastres,
        sign: -1,
      }, tx);
    });
  }
}
