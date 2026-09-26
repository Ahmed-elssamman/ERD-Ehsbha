import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, type ExpenseCategory } from '@prisma/client';

interface LinkedExpenseFacts { category: ExpenseCategory; amountPiastres: number; vehicleId: string | null; linkedTripId: string | null }
interface LinkedTripFacts { id: string; vehicleId: string; tollPiastres: number; parkingPiastres: number }

/** Both representations retain their values; disagreement requires explicit correction. */
export async function validateExpenseLink(tx: Prisma.TransactionClient, driverId: string, facts: LinkedExpenseFacts, expenseId = '', existingTripId: string | null = null): Promise<void> {
  if (!facts.linkedTripId) return;
  if (facts.category !== 'TOLL' && facts.category !== 'PARKING') throw new ConflictException({ code: 'EXPENSE_LINK_CONFLICT' });
  const trip = await tx.trip.findFirst({ where: { id: facts.linkedTripId, driverId } });
  if (!trip || (trip.deletedAt && trip.id !== existingTripId)) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
  const fee = facts.category === 'TOLL' ? trip.tollPiastres : trip.parkingPiastres;
  if (fee !== facts.amountPiastres || (facts.vehicleId && facts.vehicleId !== trip.vehicleId)) throw new ConflictException({ code: 'EXPENSE_LINK_CONFLICT' });
  const occupied = await tx.expense.findFirst({ where: { driverId, linkedTripId: trip.id, category: facts.category, deletedAt: null, id: { not: expenseId } }, select: { id: true } });
  if (occupied) throw new ConflictException({ code: 'EXPENSE_LINK_CONFLICT' });
}

export async function validateLinkedTripFees(tx: Prisma.TransactionClient, driverId: string, trip: LinkedTripFacts): Promise<void> {
  const links = await tx.expense.findMany({ where: { driverId, linkedTripId: trip.id, deletedAt: null }, select: { category: true, amountPiastres: true, vehicleId: true } });
  for (const expense of links) {
    const fee = expense.category === 'TOLL' ? trip.tollPiastres : trip.parkingPiastres;
    if (expense.amountPiastres !== fee || (expense.vehicleId && expense.vehicleId !== trip.vehicleId)) throw new ConflictException({ code: 'EXPENSE_LINK_CONFLICT' });
  }
}
