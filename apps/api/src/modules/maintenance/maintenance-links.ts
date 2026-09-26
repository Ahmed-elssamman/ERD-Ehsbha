import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type Expense } from '@prisma/client';

interface ServicePayment { costPiastres: number; vehicleId: string; linkedExpenseId: string | null }

/** Caller holds the driver's write lock; links always identify one recorded payment. */
export async function validateMaintenanceLink(tx: Prisma.TransactionClient, driverId: string, facts: ServicePayment, recordId = '', existingExpenseId: string | null = null): Promise<void> {
  if (!facts.linkedExpenseId) return;
  const expense = await tx.expense.findFirst({ where: { id: facts.linkedExpenseId, driverId } });
  if (!expense || (expense.deletedAt && expense.id !== existingExpenseId)) throw new NotFoundException({ code: 'NOT_FOUND' });
  if (expense.category !== 'OTHER' || expense.linkedTripId || expense.amountPiastres !== facts.costPiastres
    || (expense.vehicleId && expense.vehicleId !== facts.vehicleId)) throw new ConflictException({ code: 'MAINTENANCE_LINK_CONFLICT' });
  const occupied = await tx.maintenanceRecord.findFirst({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null, id: { not: recordId } }, select: { id: true } });
  const fuel = await tx.fuelLog.findFirst({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null }, select: { id: true } });
  if (occupied || fuel) throw new ConflictException({ code: 'MAINTENANCE_LINK_CONFLICT' });
}

export async function validateMaintenanceExpense(tx: Prisma.TransactionClient, driverId: string, expense: Expense): Promise<void> {
  const records = await tx.maintenanceRecord.findMany({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null }, select: { vehicleId: true, costPiastres: true } });
  for (const record of records) {
    if (expense.category !== 'OTHER' || expense.linkedTripId || expense.amountPiastres !== record.costPiastres
      || (expense.vehicleId && expense.vehicleId !== record.vehicleId)) throw new ConflictException({ code: 'MAINTENANCE_LINK_CONFLICT' });
  }
}
