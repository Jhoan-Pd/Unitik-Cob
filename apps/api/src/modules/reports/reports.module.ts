import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [DashboardController, ReportsController],
})
export class ReportsModule {}
