import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request, UseGuards, Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InAppNotifType, UserRole } from '@prisma/client';
import { JwtAuthGuard }                from '../auth/guards/jwt-auth.guard';
import { RolesGuard }                  from '../auth/guards/roles.guard';
import { Roles }                       from '../auth/decorators/roles.decorator';
import { InAppNotificationsService }   from './inapp-notifications.service';
import { OwnerGuard }                  from '../owner/guards/owner.guard';

// Metadane typów dla frontendu Ownera
export const INAPP_TYPE_META: Record<string, { label: string; description: string }> = {
  GATEWAY_OFFLINE:           { label: 'Gateway offline',            description: 'Gateway stracił połączenie (brak heartbeat > 10 min)' },
  GATEWAY_BACK_ONLINE:       { label: 'Gateway wrócił online',      description: 'Gateway przywrócił połączenie' },
  BEACON_OFFLINE:            { label: 'Beacon offline',             description: 'Beacon przy biurku nie odpowiada (> 10 min)' },
  FIRMWARE_UPDATE:           { label: 'Nowa wersja firmware',       description: 'Dostępna aktualizacja firmware beaconów na GitHub' },
  GATEWAY_RESET_NEEDED:      { label: 'Wymagany reset gateway',     description: 'Gateway wymaga restartu lub przeprowisionowania' },
  RESERVATION_CHECKIN_MISSED:{ label: 'Brak check-in (auto-release)',description: 'Biurko zwolnione z powodu braku check-in pracownika' },
  SYSTEM_ANNOUNCEMENT:       { label: 'Ogłoszenie systemowe',       description: 'Wiadomość od Ownera platformy do firm' },
};

const ALL_ROLES = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER];

@ApiTags('inapp-notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inapp')
export class InAppNotificationsController {
  private readonly logger = new Logger(InAppNotificationsController.name);

  constructor(private svc: InAppNotificationsService) {}

  // ── Moje powiadomienia ────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Moje powiadomienia (ostatnie 30)' })
  findMine(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.svc.findForUser(req.user.sub, {
      unreadOnly: unreadOnly === 'true',
      limit: 30,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Liczba nieprzeczytanych powiadomień' })
  async unreadCount(@Request() req: any) {
    const count = await this.svc.countUnread(req.user.sub);
    return { count };
  }

  @Patch('read')
  @ApiOperation({ summary: 'Oznacz wybrane powiadomienia jako przeczytane' })
  markRead(@Request() req: any, @Body('ids') ids: string[]) {
    return this.svc.markRead(req.user.sub, ids);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Oznacz wszystkie jako przeczytane' })
  markAllRead(@Request() req: any) {
    return this.svc.markAllRead(req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń powiadomienie' })
  deleteOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.deleteOne(req.user.sub, id);
  }

  // ── Owner: konfiguracja reguł ─────────────────────────────────

  @Get('rules')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Lista reguł powiadomień z metadanymi (Owner)' })
  async getRules() {
    const rules = await this.svc.getRules();
    const meta  = INAPP_TYPE_META;
    return Object.entries(meta).map(([type, m]) => {
      const rule = rules.find(r => r.type === type);
      return {
        type,
        label:       m.label,
        description: m.description,
        enabled:     rule?.enabled ?? true,
        targetRoles: rule?.targetRoles ?? [],
      };
    });
  }

  @Patch('rules/:type')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiOperation({ summary: 'Zaktualizuj regułę (Owner only)' })
  upsertRule(
    @Param('type') type: string,
    @Body() body: { enabled: boolean; targetRoles: string[] },
  ) {
    this.logger.log(`Rule update: ${type} enabled=${body.enabled} roles=${body.targetRoles.join(',')}`);
    return this.svc.upsertRule(type as InAppNotifType, body.enabled, body.targetRoles);
  }

  @Patch('rules')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiOperation({ summary: 'Zapisz wszystkie reguły naraz (Owner only)' })
  async bulkUpdateRules(
    @Body() rules: Array<{ type: string; enabled: boolean; targetRoles: string[] }>,
  ) {
    const results = await Promise.all(
      rules.map(r => this.svc.upsertRule(r.type as InAppNotifType, r.enabled, r.targetRoles))
    );
    this.logger.log(`Bulk rules saved: ${results.length}`);
    return results;
  }

  @Post('announce')
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @ApiOperation({ summary: 'Wyślij ogłoszenie do wybranych ról (Owner only)' })
  async announce(
    @Body() body: { title: string; body: string; targetRoles?: string[] },
  ) {
    const count = await this.svc.createAnnouncement(body.title, body.body, body.targetRoles);
    this.logger.log(`Announcement sent to ${count} users: "${body.title}"`);
    return { ok: true, recipientCount: count };
  }
}
