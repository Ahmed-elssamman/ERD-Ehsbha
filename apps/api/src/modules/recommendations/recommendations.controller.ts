import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { RecommendationsService } from './recommendations.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get('recommendations')
  list(
    @CurrentDriverId() driverId: string,
    @Query('surface') surface = 'home',
  ) {
    return this.svc.listActive(driverId, surface);
  }

  @Post('recommendations/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
  ) {
    await this.svc.dismiss(driverId, id);
  }

  @Get('decisions/today')
  today(@CurrentDriverId() driverId: string) {
    return this.svc.todaysDecisions(driverId);
  }
}
