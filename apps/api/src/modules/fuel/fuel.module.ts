import { Module } from '@nestjs/common';
import { FuelController } from './fuel.controller';
import { FuelQueriesService } from './fuel-queries.service';
import { FuelService } from './fuel.service';
import { AggregatesModule } from '../aggregates/aggregates.module';

@Module({
  imports: [AggregatesModule],
  controllers: [FuelController],
  providers: [FuelService, FuelQueriesService],
  exports: [FuelService],
})
export class FuelModule {}
