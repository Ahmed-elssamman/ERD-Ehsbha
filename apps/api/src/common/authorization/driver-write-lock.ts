import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Serialize financial changes and their acknowledgements for one driver. */
export async function lockDriverWrites(tx: Prisma.TransactionClient, driverId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM drivers WHERE id = ${driverId} FOR UPDATE`;
  if (!rows.length) throw new NotFoundException({ code: 'NOT_FOUND' });
}
