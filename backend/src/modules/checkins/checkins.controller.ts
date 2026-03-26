import {
  Controller, Post, Patch, Body, Param,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckinsService } from './checkins.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class QrCheckinDto {
  @ApiProperty() @IsString() @IsNotEmpty() deskId: string;
  @ApiProperty() @IsString() @IsNotEmpty() qrToken: string;
}

class ManualCheckinDto {
  @ApiProperty() @IsString() @IsNotEmpty() deskId: string;
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reservationId?: string;
}

class NfcCheckinDto {
  @ApiProperty() @IsString() @IsNotEmpty() deskId: string;
  @ApiProperty() @IsString() @IsNotEmpty() cardUid: string;
  @ApiProperty() @IsString() @IsNotEmpty() gatewayId: string;
}

@ApiTags('checkins')
@ApiBearerAuth()
@Controller('checkins')
export class CheckinsController {
  constructor(private svc: CheckinsService) {}

  @Post('nfc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN) // called by gateway service account
  @ApiOperation({ summary: 'NFC check-in (gateway → server)' })
  @HttpCode(HttpStatus.OK)
  nfc(@Body() dto: NfcCheckinDto) {
    return this.svc.checkinNfc(dto.deskId, dto.cardUid, dto.gatewayId);
  }

  @Post('qr')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'QR check-in (user has reservation)' })
  @HttpCode(HttpStatus.OK)
  qr(@Body() dto: QrCheckinDto, @Request() req) {
    return this.svc.checkinQr(req.user.id, dto.deskId, dto.qrToken);
  }

  @Post('qr/walkin')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'QR walk-in — no reservation, creates one + checks in' })
  @HttpCode(HttpStatus.OK)
  walkin(@Body('deskId') deskId: string, @Request() req) {
    return this.svc.walkinQr(req.user.id, deskId);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Manual check-in (Staff panel)' })
  manual(@Body() dto: ManualCheckinDto, @Request() req) {
    return this.svc.checkinManual(dto.deskId, dto.userId, dto.reservationId);
  }

  @Patch(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check out' })
  checkout(@Param('id') id: string, @Request() req) {
    return this.svc.checkout(id, req.user.id, req.user.role);
  }
}
