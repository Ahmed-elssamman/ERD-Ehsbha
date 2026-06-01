import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDriverAppDto, UpdateDriverAppDto } from './dto/apps.dto';

const CUSTOM_CODE = 'CUSTOM';

@Injectable()
export class AppsService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalog() {
    return this.prisma.appSource.findMany({
      where: { isSystem: true },
      orderBy: { name: 'asc' },
    });
  }

  listForDriver(driverId: string) {
    return this.prisma.driverApp.findMany({
      where: { driverId },
      include: { appSource: true },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addForDriver(driverId: string, dto: CreateDriverAppDto) {
    let appSourceId = dto.appSourceId;
    if (!appSourceId) {
      const custom = await this.prisma.appSource.upsert({
        where: { code: CUSTOM_CODE },
        update: {},
        create: {
          code: CUSTOM_CODE,
          name: 'Custom',
          defaultCommissionPct: 0,
          isSystem: false,
        },
      });
      appSourceId = custom.id;
    }

    try {
      return await this.prisma.driverApp.create({
        data: {
          driverId,
          appSourceId,
          customName: dto.customName ?? null,
          commissionPct: dto.commissionPct,
          color: dto.color ?? null,
          enabled: dto.enabled,
        },
        include: { appSource: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException({ code: 'DRIVER_APP_DUPLICATE', message: 'You already added this app' });
      }
      throw e;
    }
  }

  async update(driverId: string, id: string, dto: UpdateDriverAppDto) {
    const row = await this.prisma.driverApp.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'DRIVER_APP_NOT_FOUND' });
    return this.prisma.driverApp.update({
      where: { id },
      data: dto,
      include: { appSource: true },
    });
  }

  async remove(driverId: string, id: string) {
    const row = await this.prisma.driverApp.findFirst({ where: { id, driverId } });
    if (!row) throw new NotFoundException({ code: 'DRIVER_APP_NOT_FOUND' });
    await this.prisma.driverApp.delete({ where: { id } });
  }
}
