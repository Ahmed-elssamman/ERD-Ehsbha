import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentDriverId } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import {
  CommunityService,
  CreatePostDto,
  CreatePostSchema,
  ListPostsDto,
  ListPostsSchema,
  ReactDto,
  ReactSchema,
} from './community.service';

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly svc: CommunityService) {}

  @Get('categories')
  categories() {
    return this.svc.listCategories();
  }

  @Get('posts')
  list(
    @CurrentDriverId() driverId: string,
    @Query(new ZodValidationPipe(ListPostsSchema)) q: ListPostsDto,
  ) {
    return this.svc.list(driverId, q);
  }

  @Post('posts')
  create(
    @CurrentDriverId() driverId: string,
    @Body(new ZodValidationPipe(CreatePostSchema)) dto: CreatePostDto,
  ) {
    return this.svc.create(driverId, dto);
  }

  @Post('posts/:id/react')
  react(
    @CurrentDriverId() driverId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReactSchema)) dto: ReactDto,
  ) {
    return this.svc.react(driverId, id, dto);
  }

  @Delete('posts/:id')
  remove(@CurrentDriverId() driverId: string, @Param('id') id: string) {
    return this.svc.remove(driverId, id);
  }
}
