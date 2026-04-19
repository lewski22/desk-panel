import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';
import { UserRole }     from '@prisma/client';
import { InAppNotificationsService } from './inapp-notifications.service';

@ApiTags('notifications-inapp')
@Controller('notifications/inapp')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InAppNotificationsController {
  constructor(private svc: InAppNotificationsService) {}

  // ── User endpoints ───────────────────────────────────────────
  @Get()
  getForUser(@Request() req: any, @Query('unread') unread?: string) {
    return this.svc.getForUser(req.user.id, { unreadOnly: unread === 'true', limit: 50 });
  }

  @Get('count')
  countUnread(@Request() req: any) { return this.svc.countUnread(req.user.id); }

  @Patch('read-all')
  markAllRead(@Request() req: any) { return this.svc.markAllRead(req.user.id); }

  @Patch('read')
  markRead(@Body('ids') ids: string[], @Request() req: any) { return this.svc.markRead(req.user.id, ids); }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @Request() req: any) { return this.svc.deleteOne(req.user.id, id); }

  // ── Owner/Admin — notification rules ─────────────────────────
  @Get('rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  getRules() { return this.svc.getRules(); }

  @Post('rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  async saveRules(@Body() body: { rules: { type: string; enabled: boolean; targetRoles: string[] }[] }) {
    for (const r of body.rules) {
      await this.svc.upsertRule(r.type as any, r.enabled, r.targetRoles);
    }
    return this.svc.getRules();
  }

  // ── Owner — system announcement ──────────────────────────────
  @Post('announce')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  announce(@Body() body: { title: string; body: string; targetRoles: string[] }) {
    return this.svc.announce(body.title, body.body, body.targetRoles);
  }
}
