import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request, UseGuards,
  HttpCode, HttpStatus, InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';
import { NfcScanService } from '../../shared/nfc-scan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private svc:     UsersService,
    private nfcScan: NfcScanService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  findAll(@Request() req: any) {
    // OWNER widzi wszystkich użytkowników; SUPER_ADMIN/OFFICE_ADMIN tylko własną org
    // Usunięto @Query('organizationId') — admin nie może odpytać cudzej org
    const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findAll(orgId);
  }

  @Get('deactivated')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'List deactivated users pending deletion' })
  findDeactivated(@Request() req: any) {
    const orgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findDeactivated(orgId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  findOne(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findOne(id, actorOrgId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create user account' })
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update user (role change to SUPER_ADMIN requires SUPER_ADMIN actor)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.update(id, dto, req.user.role, actorOrgId);
  }

  @Patch(':id/card')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Assign NFC card UID to user' })
  assignCard(@Param('id') id: string, @Body('cardUid') cardUid: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.updateCardUid(id, cardUid, actorOrgId);
  }

  @Patch(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Restore deactivated user account' })
  restore(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.restore(id, actorOrgId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Soft delete user (sets scheduledDeleteAt)' })
  deactivate(
    @Param('id') id: string,
    @Body('retentionDays') retentionDays?: number,
    @Request() req?: any,
  ) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.softDelete(id, retentionDays ?? 30, actorOrgId);
  }

  @Post(':id/nfc-scan-start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start 60s NFC scan session — next unknown card scan will be assigned' })
  async nfcScanStart(@Param('id') id: string, @Request() req: any) {
    // Start sesji asynchronicznie — nie blokuj HTTP
    this.nfcScan.startSession(req.user.id, 60_000)
      .then(async (cardUid: string) => {
        try {
          await this.svc.updateCardUid(id, cardUid);
        } catch { /* race condition — ignore */ }
      })
      .catch(() => { /* timeout or cancelled — ignore */ });

    return { status: 'waiting', message: 'Zbliż kartę NFC do dowolnego beacona w biurze (60s)' };
  }

  @Get(':id/nfc-scan-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Poll NFC scan session status' })
  async nfcScanStatus(@Param('id') id: string, @Request() req: any) {
    const isWaiting = this.nfcScan.hasActiveSession(req.user.id);
    // Pobierz aktualny cardUid z DB — jeśli sesja się zakończyła, UID już jest zapisany
    const user = await this.svc.findOne(id);
    if (user.cardUid && !isWaiting) {
      return { status: 'found', cardUid: user.cardUid };
    }
    if (isWaiting) {
      const age = this.nfcScan.getSessionAge(req.user.id) ?? 0;
      return { status: 'waiting', secondsLeft: Math.max(0, Math.round((60_000 - age) / 1000)) };
    }
    return { status: 'timeout' };
  }

  @Delete(':id/permanent')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Permanently anonymize user data after retention period' })
  hardDelete(@Param('id') id: string) {
    return this.svc.hardDelete(id);
  }
}
