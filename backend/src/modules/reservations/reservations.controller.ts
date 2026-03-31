// ── reservations.controller.ts ───────────────────────────────
import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  @ApiOperation({ summary: 'List reservations (filterable)' })
  findAll(
    @Query('locationId') locationId?: string,
    @Query('deskId') deskId?: string,
    @Query('date') date?: string,
    @Query('status') status?: any,
  ) {
    return this.svc.findAll({ locationId, deskId, date, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR check-in token for own reservation' })
  getQr(@Param('id') id: string, @Request() req) {
    return this.svc.getQrToken(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create reservation' })
  create(@Body() dto: CreateReservationDto, @Request() req) {
    return this.svc.create(req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel reservation' })
  cancel(@Param('id') id: string, @Request() req) {
    return this.svc.cancel(id, req.user.id, req.user.role);
  }
}
