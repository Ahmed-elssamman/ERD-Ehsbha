import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';

export const CreateAreaSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CreateAreaDto = z.infer<typeof CreateAreaSchema>;

export const UpdateAreaSchema = CreateAreaSchema.partial();
export type UpdateAreaDto = z.infer<typeof UpdateAreaSchema>;

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  list(driverId: string) {
    return this.prisma.area.findMany({ where: { driverId }, orderBy: { name: 'asc' } });
  }

  create(driverId: string, dto: CreateAreaDto) {
    return this.prisma.area.create({ data: { driverId, name: dto.name, color: dto.color ?? null } });
  }

  async update(driverId: string, id: string, dto: UpdateAreaDto) {
    const row = await this.prisma.area.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'AREA_NOT_FOUND' });
    return this.prisma.area.update({ where: { id }, data: dto });
  }

  async remove(driverId: string, id: string) {
    const row = await this.prisma.area.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'AREA_NOT_FOUND' });
    await this.prisma.area.delete({ where: { id } });
  }
}
