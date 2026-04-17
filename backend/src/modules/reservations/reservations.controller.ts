// ── reservations.controller.ts ───────────────────────────────
import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';
import { UserRole }     from '@prisma/client';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private svc: ReservationsService) {}

  // M3: Moje rezerwacje — dla Outlook Add-in i Staff Panel
  @Get('my')
  @ApiOperation({ summary: 'Moje aktywne rezerwacje (opcjonalnie filtr po dacie, max 50)' })
  findMy(
    @Query('date')  date:  string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const take = Math.min(parseInt(limit) || 50, 100);
    return this.svc.findMy(req.user.id, date, take);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List reservations (STAFF+) — filterable, org-isolated' })
  findAll(
    @Query('locationId') locationId?: string,
    @Query('deskId') deskId?: string,
    @Query('date') date?: string,
    @Query('status') status?: any,
    @Request() req?: any,
  ) {
    // OWNER widzi wszystko; SUPER_ADMIN/OFFICE_ADMIN/STAFF — tylko swoją org
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findAll({ locationId, deskId, date, status, actorOrgId });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  findOne(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.findOne(id, actorOrgId);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR check-in token for own reservation' })
  getQr(@Param('id') id: string, @Request() req) {
    return this.svc.getQrToken(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create reservation' })
  create(@Body() dto: CreateReservationDto, @Request() req) {
    // Dodaj actorOrgId do DTO — serwis sprawdzi czy biurko należy do tej org
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.create(req.user.id, dto, actorOrgId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel reservation' })
  cancel(@Param('id') id: string, @Request() req) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.cancel(id, req.user.id, req.user.role, actorOrgId);
  }

  // ── Sprint G1: Cykliczne rezerwacje ──────────────────────────
  @Post('recurring')
  @ApiOperation({ summary: 'Create recurring reservation series (RRULE)' })
  createRecurring(@Body() body: any, @Request() req: any) {
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.createRecurring(req.user.id, body, actorOrgId);
  }

  @Post(':id/cancel-recurring')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel one/following/all instances of a recurring series' })
  cancelRecurring(
    @Param('id') id: string,
    @Body() body:    { scope: 'single' | 'following' | 'all' },
    @Request() req:  any,
  ) {
    return this.svc.cancelRecurring(id, body.scope, req.user.id, req.user.role);
  }
}
