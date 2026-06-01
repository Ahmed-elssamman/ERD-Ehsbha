import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AppsService } from './apps.service';
import { CreateDriverAppDto, CreateDriverAppSchema, UpdateDriverAppDto, UpdateDriverAppSchema } from './dto/apps.dto';

@Controller()
export class AppsController {
  constructor(private readonly svc: AppsService) {}

  @Get('apps')
  catalog() {
    return this.svc.listCatalog();
  }

  @Get('drivers/me/apps')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentDriverId() driverId: string) {
    return this.svc.listForDriver(driverId);
  }

  @Post('drivers/me/apps')
  @UseGuards(JwtAuthGuard)
  add(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreateDriverAppSchema)) dto: CreateDriverAppDto,
  ) {
    return this.svc.addForDriver(driverId, dto);
  }

  @Patch('drivers/me/apps/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDriverAppSchema)) dto: UpdateDriverAppDto,
  ) {
    return this.svc.update(driverId, id, dto);
  }

  @Delete('drivers/me/apps/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    await this.svc.remove(driverId, id);
  }
}
