import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { TripsModule } from '../trips/trips.module';
import { FuelModule } from '../fuel/fuel.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [TripsModule, FuelModule, ExpensesModule, SessionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
