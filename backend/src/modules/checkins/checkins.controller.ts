import { Controller, Post, Patch, Body, Param, Request, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client'; import { CheckinsService } from './checkins.service';
import { PrismaService } from '../../database/prisma.service';
import { GatewayJwtGuard } from '../gateways/guards/gateway-jwt.guard';
import { NfcCheckinDto }    from './dto/nfc-checkin.dto';
import { QrCheckinDto }     from './dto/qr-checkin.dto';
import { ManualCheckinDto } from './dto/manual-checkin.dto';
@ApiTags('checkins') @Controller('checkins')
export class CheckinsController {
  constructor(private svc: CheckinsService, private prisma: PrismaService) {}
  @Post('nfc') @UseGuards(GatewayJwtGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'NFC check-in from gateway'})
  async nfc(@Body() dto: NfcCheckinDto, @Request() req: any) {
    const gwId = req.gatewayId;
    const gw = await this.prisma.gateway.findUnique({ where: { id: gwId }, select: { locationId: true } });
    if (!gw) throw new ForbiddenException('Gateway not found');
    const desk = await this.prisma.desk.findUnique({ where: { id: dto.deskId }, select: { locationId: true } });
    if (!desk || desk.locationId !== gw.locationId) throw new ForbiddenException('Desk not in gateway location');
    return this.svc.checkinNfc(dto.deskId, dto.cardUid, gwId);
  }
  @Post('qr') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'QR check-in'})
  qr(@Body() dto: QrCheckinDto, @Request() req: any) { return this.svc.checkinQr(req.user.id,dto.deskId,dto.qrToken); }
  @Post('qr/walkin') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'QR walk-in'})
  walkin(@Body('deskId') deskId: string, @Request() req: any) { return this.svc.walkinQr(req.user.id,deskId); }
  @Post('manual') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.SUPER_ADMIN,UserRole.OFFICE_ADMIN,UserRole.STAFF) @ApiOperation({summary:'Manual check-in'})
  manual(@Body() dto: ManualCheckinDto, @Request() req: any) { return this.svc.manual(dto.deskId,dto.userId,dto.reservationId,req.user.organizationId); }
  @Post('web') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Web check-in (self-service)'})
  web(@Body('reservationId') reservationId: string, @Request() req: any) { return this.svc.checkinWeb(req.user.id, reservationId); }
  @Patch(':id/checkout') @UseGuards(JwtAuthGuard) @ApiOperation({summary:'Check out'})
  checkout(@Param('id') id: string, @Request() req: any) { return this.svc.checkout(id,req.user.id,req.user.role); }

  @Post('parking-qr') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Parking QR check-in'})
  checkinParkingQr(@Body() dto: { resourceQrToken: string }, @Request() req: any) {
    return this.svc.checkinParkingQr(req.user.id, dto.resourceQrToken);
  }
}
