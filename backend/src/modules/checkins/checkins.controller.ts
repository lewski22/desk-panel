import { Controller, Post, Patch, Body, Headers, Param, Request, UseGuards, HttpCode, HttpStatus, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client'; import { CheckinsService } from './checkins.service';
import { GatewaysService } from '../gateways/gateways.service'; import { PrismaService } from '../../database/prisma.service';
@ApiTags('checkins') @Controller('checkins')
export class CheckinsController {
  constructor(private svc: CheckinsService, private gateways: GatewaysService, private prisma: PrismaService) {}
  @Post('nfc') @HttpCode(HttpStatus.OK) @ApiOperation({summary:'NFC check-in from gateway'})
  async nfc(@Body() dto: any, @Headers('x-gateway-id') gwId?: string, @Headers('x-gateway-secret') secret?: string) {
    if(!gwId||!secret) throw new UnauthorizedException('Missing gateway credentials');
    await this.gateways.authenticate(gwId,secret);
    const gw=await this.prisma.gateway.findUnique({where:{id:gwId},include:{location:{select:{id:true}}}});
    if(!gw) throw new UnauthorizedException('Gateway not found');
    const desk=await this.prisma.desk.findUnique({where:{id:dto.deskId},select:{locationId:true}});
    if(!desk||desk.locationId!==gw.locationId) throw new ForbiddenException('Desk not in gateway location');
    return this.svc.checkinNfc(dto.deskId,dto.cardUid,gwId);
  }
  @Post('qr') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'QR check-in'})
  qr(@Body() dto: any, @Request() req: any) { return this.svc.checkinQr(req.user.id,dto.deskId,dto.qrToken); }
  @Post('qr/walkin') @UseGuards(JwtAuthGuard) @HttpCode(HttpStatus.OK) @ApiOperation({summary:'QR walk-in'})
  walkin(@Body('deskId') deskId: string, @Request() req: any) { return this.svc.walkinQr(req.user.id,deskId); }
  @Post('manual') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(UserRole.SUPER_ADMIN,UserRole.OFFICE_ADMIN,UserRole.STAFF) @ApiOperation({summary:'Manual check-in'})
  manual(@Body() dto: any, @Request() req: any) { return this.svc.manual(dto.deskId,dto.userId,dto.reservationId,req.user.organizationId); }
  @Patch(':id/checkout') @UseGuards(JwtAuthGuard) @ApiOperation({summary:'Check out'})
  checkout(@Param('id') id: string, @Request() req: any) { return this.svc.checkout(id,req.user.id,req.user.role); }
}
