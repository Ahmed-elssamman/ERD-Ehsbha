import { AggregatesModule } from '../aggregates/aggregates.module';
import { Module } from '@nestjs/common';
import { ScoreController } from './score.controller';
import { ScoreService } from './score.service';

@Module({
  imports: [AggregatesModule],
  controllers: [ScoreController],
  providers: [ScoreService],
  exports: [ScoreService],
})
export class ScoreModule {}
