import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RemindersCron } from './reminders.cron';

@Module({
  imports: [JwtModule.register({})], // secret provided per-verify (gateway)
  controllers: [NotificationsController],
  providers: [NotificationsService, EventsGateway, RemindersCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
