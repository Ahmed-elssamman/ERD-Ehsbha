import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type Expense } from '@prisma/client';

interface FuelPayment { totalPiastres: number; vehicleId: string; linkedExpenseId: string | null }

/** Caller holds the driver's write lock. An expense can represent one active source payment. */
export async function validateFuelLink(tx: Prisma.TransactionClient, driverId: string, facts: FuelPayment, recordId = '', existingExpenseId: string | null = null): Promise<void> {
  if (!facts.linkedExpenseId) return;
  const expense = await tx.expense.findFirst({ where: { id: facts.linkedExpenseId, driverId } });
  if (!expense || (expense.deletedAt && expense.id !== existingExpenseId)) throw new NotFoundException({ code: 'NOT_FOUND' });
  if (expense.category !== 'OTHER' || expense.linkedTripId || expense.amountPiastres !== facts.totalPiastres
    || (expense.vehicleId && expense.vehicleId !== facts.vehicleId)) throw new ConflictException({ code: 'FUEL_LINK_CONFLICT' });
  const occupied = await tx.fuelLog.findFirst({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null, id: { not: recordId } }, select: { id: true } });
  const service = await tx.maintenanceRecord.findFirst({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null }, select: { id: true } });
  if (occupied || service) throw new ConflictException({ code: 'FUEL_LINK_CONFLICT' });
}

export async function validateFuelExpense(tx: Prisma.TransactionClient, driverId: string, expense: Expense): Promise<void> {
  const records = await tx.fuelLog.findMany({ where: { driverId, linkedExpenseId: expense.id, deletedAt: null }, select: { vehicleId: true, totalPiastres: true } });
  for (const record of records) {
    if (expense.category !== 'OTHER' || expense.linkedTripId || expense.amountPiastres !== record.totalPiastres
      || (expense.vehicleId && expense.vehicleId !== record.vehicleId)) throw new ConflictException({ code: 'FUEL_LINK_CONFLICT' });
  }
}
