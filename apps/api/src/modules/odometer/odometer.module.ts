import { Module } from '@nestjs/common';
import { OdometerController } from './odometer.controller';
import { OdometerService } from './odometer.service';
import { AggregatesModule } from '../aggregates/aggregates.module';

@Module({
  imports: [AggregatesModule],
  controllers: [OdometerController],
  providers: [OdometerService],
  exports: [OdometerService],
})
export class OdometerModule {}
