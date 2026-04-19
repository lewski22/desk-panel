import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InAppNotificationsService } from './inapp-notifications.service';
@ApiTags('notifications-inapp') @Controller('notifications/inapp') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
export class InAppNotificationsController {
  constructor(private svc: InAppNotificationsService) {}
  @Get() getForUser(@Request() req: any, @Query('unread') unread?: string) {
    return this.svc.getForUser(req.user.id,{unreadOnly:unread==='true',limit:50});
  }
  @Get('count') countUnread(@Request() req: any) { return this.svc.countUnread(req.user.id); }
  @Patch('read-all') markAllRead(@Request() req: any) { return this.svc.markAllRead(req.user.id); }
  @Patch('read') markRead(@Body('ids') ids: string[], @Request() req: any) { return this.svc.markRead(req.user.id,ids); }
  @Delete(':id') deleteOne(@Param('id') id: string, @Request() req: any) { return this.svc.deleteOne(req.user.id,id); }
}
