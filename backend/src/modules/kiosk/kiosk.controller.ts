import {
  Controller, Post, Get, Patch, Body, Request,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }           from '../auth/guards/jwt-auth.guard';
import { RolesGuard }             from '../auth/guards/roles.guard';
import { Roles }                  from '../auth/decorators/roles.decorator';
import { UserRole }               from '@prisma/client';
import { KioskService }           from './kiosk.service';
import { UpdateKioskSettingsDto } from './dto/kiosk-settings.dto';
import { UpdateKioskStatusDto }   from './dto/kiosk-status.dto';

@ApiTags('kiosk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kiosk')
export class KioskController {
  constructor(private svc: KioskService) {}

  // ── Admin — zarządzanie kontem (OA + SA) ──────────────────────

  @Post('account')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Utwórz konto KIOSK dla org (jednorazowe hasło w odpowiedzi)' })
  createAccount(@Request() req: any, @Body() body: { locationId?: string }) {
    return this.svc.createAccount(req.user.organizationId, body?.locationId);
  }

  @Get('account')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Pobierz dane konta KIOSK org (bez hasła)' })
  getAccount(@Request() req: any) {
    return this.svc.getAccount(req.user.organizationId);
  }

  @Patch('account/password')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Reset hasła konta KIOSK (jednorazowe hasło w odpowiedzi)' })
  resetPassword(@Request() req: any) {
    return this.svc.resetPassword(req.user.organizationId);
  }

  @Patch('account/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Aktywuj / dezaktywuj konto KIOSK' })
  async toggleStatus(@Request() req: any, @Body() dto: UpdateKioskStatusDto) {
    await this.svc.toggleStatus(req.user.organizationId, dto.isActive);
  }

  // ── KIOSK self — ustawienia ───────────────────────────────────

  @Get('me/settings')
  @Roles(UserRole.KIOSK)
  @ApiOperation({ summary: 'Pobierz kioskSettings zalogowanego konta KIOSK' })
  getSettings(@Request() req: any) {
    return this.svc.getSettings(req.user.id);
  }

  @Patch('me/settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.KIOSK)
  @ApiOperation({ summary: 'Zaktualizuj kioskSettings' })
  async updateSettings(@Request() req: any, @Body() dto: UpdateKioskSettingsDto) {
    await this.svc.updateSettings(req.user.id, req.user.organizationId, dto);
  }
}
