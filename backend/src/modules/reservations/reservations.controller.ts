// ── reservations.controller.ts ───────────────────────────────
import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/roles.guard';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private svc: ReservationsService) {}

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
