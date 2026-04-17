import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }   from '../auth/guards/jwt-auth.guard';
import { RolesGuard }     from '../auth/roles.guard';
import { Roles }          from '../auth/roles.decorator';
import { UserRole }       from '@prisma/client';
import { VisitorsService } from './visitors.service';

@ApiTags('visitors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VisitorsController {
  constructor(private readonly svc: VisitorsService) {}

  @Get('locations/:locationId/visitors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'List visitors for a location on a given date' })
  findAll(
    @Param('locationId') locationId: string,
    @Query('date')       date?: string,
    @Request()           req?: any,
  ) {
    const orgId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.organizationId;
    return this.svc.findAll(locationId, date, orgId);
  }

  @Post('locations/:locationId/visitors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Invite a visitor' })
  invite(
    @Param('locationId') locationId: string,
    @Body()              body: any,
    @Request()           req: any,
  ) {
    return this.svc.invite(locationId, req.user.id, body);
  }

  @Post('visitors/:id/checkin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Manual check-in visitor' })
  checkin(@Param('id') id: string) {
    return this.svc.checkin(id);
  }

  @Post('visitors/qr/:token')
  @HttpCode(200)
  @ApiOperation({ summary: 'QR code check-in (public — no auth)' })
  checkinQr(@Param('token') token: string) {
    return this.svc.checkinByQr(token);
  }

  @Post('visitors/:id/checkout')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-out visitor' })
  checkout(@Param('id') id: string) {
    return this.svc.checkout(id);
  }

  @Post('visitors/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel visit invitation' })
  cancel(@Param('id') id: string) {
    return this.svc.cancel(id);
  }
}
