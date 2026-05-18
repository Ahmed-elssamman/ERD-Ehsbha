import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  ListReviewsDto,
  ListReviewsSchema,
  ReviewsService,
  UpsertReviewDto,
  UpsertReviewSchema,
} from './reviews.service';

/** Public reviews / testimonials endpoint — used on login, register, marketing surfaces. */
@Controller('public/reviews')
export class PublicReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('featured')
  featured(@Query('limit') limit?: string) {
    const n = limit ? Math.max(1, Math.min(12, Number(limit))) : 6;
    return this.svc.featured(n);
  }

  @Get('summary')
  summary() {
    return this.svc.summary();
  }
}

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('summary')
  summary() {
    return this.svc.summary();
  }

  @Get()
  list(@Query(new ZodValidationPipe(ListReviewsSchema)) q: ListReviewsDto) {
    return this.svc.list(q);
  }

  @Get('me')
  mine(@CurrentDriverId() driverId: string) {
    return this.svc.getMine(driverId);
  }

  @Put('me')
  upsert(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(UpsertReviewSchema)) dto: UpsertReviewDto,
  ) {
    return this.svc.upsertMine(driverId, dto);
  }

  @Post('me')
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(UpsertReviewSchema)) dto: UpsertReviewDto,
  ) {
    return this.svc.upsertMine(driverId, dto);
  }

  @Delete('me')
  removeMine(@CurrentDriverId() driverId: string) {
    return this.svc.deleteMine(driverId);
  }
}
