import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  @ApiOperation({ summary: 'Mi bandeja de notificaciones (cliente o personal)' })
  my(@CurrentUser() user: AuthenticatedUser): Promise<Notification[]> {
    return this.notificationsService.myNotifications(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Notification> {
    return this.notificationsService.markRead(id, user.id);
  }

  /** Every 5 minutes: dispatch pending notifications through their channels. */
  @Cron('*/5 * * * *', { timeZone: 'America/Bogota' })
  dispatch(): Promise<{ sent: number; failed: number }> {
    return this.notificationsService.dispatchPending();
  }
}
