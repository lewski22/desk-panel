import {
  Controller, Get, Put, Post, Body, Param, Query,
  UseGuards, Request, Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard }         from '../auth/guards/jwt-auth.guard';
import { RolesGuard }           from '../auth/guards/roles.guard';
import { Roles }                from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_META }    from './notification-types';
import { UpsertSettingDto }        from './dto/upsert-setting.dto';
import { BulkSettingItemDto }      from './dto/bulk-upsert-settings.dto';
import { SaveSmtpDto }             from './dto/save-smtp.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private svc: NotificationsService) {}

  // ── Lista typów powiadomień z metadanymi ──────────────────────
  @Get('types')
  @ApiOperation({ summary: 'Lista dostępnych typów powiadomień z opisami' })
  getTypes() {
    return Object.entries(NOTIFICATION_META).map(([type, meta]) => ({
      type,
      ...meta,
    }));
  }

  // ── Ustawienia dla mojej organizacji ──────────────────────────
  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Pobierz ustawienia powiadomień dla organizacji' })
  async getSettings(@Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) return [];
    const saved = await this.svc.getSettings(orgId);

    // Zwróć wszystkie typy — zapisane z DB, niezapisane z domyślnymi wartościami
    return Object.entries(NOTIFICATION_META).map(([type, meta]) => {
      const s = saved.find(x => x.type === type);
      return {
        type,
        label:        meta.label,
        description:  meta.description,
        category:     meta.category,
        hasThreshold: meta.hasThreshold,
        enabled:      s?.enabled ?? false,
        recipients:   s?.recipients ?? [],
        thresholdMin: s?.thresholdMin ?? 10,
        id:           s?.id,
      };
    });
  }

  // ── Zaktualizuj jedno ustawienie ─────────────────────────────
  @Put('settings/:type')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Włącz/wyłącz powiadomienie i ustaw odbiorców' })
  async upsertSetting(
    @Param('type')  type:    string,
    @Body()         body:    UpsertSettingDto,
    @Request()      req:     any,
  ) {
    const orgId = req.user.organizationId;
    if (!orgId) return { error: 'No organization' };
    this.logger.log(`NotificationSetting: org=${orgId} type=${type} enabled=${body.enabled}`);
    return this.svc.upsertSetting(orgId, type, body);
  }

  // ── Bulk update (zapisz wszystkie ustawienia naraz) ──────────
  @Put('settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Zapisz wiele ustawień powiadomień naraz' })
  async bulkUpsert(
    @Body()    settings: BulkSettingItemDto[],
    @Request() req:      any,
  ) {
    const orgId = req.user.organizationId;
    if (!orgId) return [];
    const results = await Promise.all(
      settings.map(s => this.svc.upsertSetting(orgId, s.type, s))
    );
    this.logger.log(`Bulk notification settings saved: org=${orgId} count=${results.length}`);
    return results;
  }

  // ── Historia wysłanych powiadomień ───────────────────────────
  @Get('log')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Historia wysłanych powiadomień (ostatnie 50)' })
  async getLog(@Request() req: any, @Query('limit') limit?: string) {
    const orgId = req.user.organizationId;
    if (!orgId) return [];
    return this.svc.getLog(orgId, limit ? parseInt(limit) : 50);
  }

  // ── Test wysyłki ─────────────────────────────────────────────
  @Post('test')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Wyślij testowy email aby sprawdzić konfigurację SMTP' })
  async testSend(@Body('email') email: string, @Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId || !email) return { ok: false, error: 'Missing email or organization' };
    return this.svc.testSend(orgId, email);
  }
  // ── SMTP per org — konfiguracja własnej skrzynki ─────────────

  @Get('smtp')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Pobierz konfigurację SMTP organizacji (bez hasła)' })
  async getSmtp(@Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) return null;
    const cfg  = await this.svc.mailer.getOrgSmtpPublic(orgId);
    const hasGlobal = this.svc.mailer.isGlobalConfigured;
    return { config: cfg, globalAvailable: hasGlobal };
  }

  @Put('smtp')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Zapisz własną konfigurację SMTP (hasło szyfrowane AES-256)' })
  async saveSmtp(
    @Body() body: SaveSmtpDto,
    @Request() req: any,
  ) {
    const orgId = req.user.organizationId;
    if (!orgId) return { error: 'No organization' };
    await this.svc.mailer.saveOrgSmtp(orgId, body);
    this.logger.log(`Org SMTP saved: org=${orgId} host=${body.host}`);
    return { ok: true };
  }

  @Post('smtp/test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Testuj własną skrzynkę SMTP — wyślij email weryfikacyjny' })
  async testSmtp(@Body('email') email: string, @Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId || !email) return { ok: false, error: 'Missing params' };
    return this.svc.mailer.testOrgSmtp(orgId, email);
  }

  @Post('smtp/delete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Usuń własną konfigurację SMTP — wróć do skrzynki globalnej' })
  async deleteSmtp(@Request() req: any) {
    const orgId = req.user.organizationId;
    if (!orgId) return { ok: false };
    await this.svc.mailer.deleteOrgSmtp(orgId);
    this.logger.log(`Org SMTP removed: org=${orgId}`);
    return { ok: true };
  }

}
