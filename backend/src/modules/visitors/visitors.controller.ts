import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }   from '../auth/guards/jwt-auth.guard';
import { RolesGuard }     from '../auth/guards/roles.guard';
import { Roles }          from '../auth/decorators/roles.decorator';
import { UserRole }       from '@prisma/client';
import { VisitorsService }    from './visitors.service';
import { InviteVisitorDto } from './dto/invite-visitor.dto';

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
    @Body()              body: InviteVisitorDto,
    @Request()           req: any,
  ) {
    const actorOrgId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.organizationId;
    return this.svc.invite(locationId, req.user.id, body, actorOrgId);
  }

  @Post('visitors/:id/checkin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Manual check-in visitor' })
  checkin(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.organizationId;
    return this.svc.checkin(id, actorOrgId);
  }

  @Post('visitors/qr/:token')
  @HttpCode(200)
  @ApiOperation({ summary: 'QR code check-in' })
  checkinQr(@Param('token') token: string) { return this.svc.checkinByQr(token); }

  @Post('visitors/:id/checkout')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-out visitor' })
  checkout(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.organizationId;
    return this.svc.checkout(id, actorOrgId);
  }

  @Post('visitors/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel visit invitation' })
  cancel(@Param('id') id: string, @Request() req: any) {
    const actorOrgId = req.user.role === 'SUPER_ADMIN' ? undefined : req.user.organizationId;
    return this.svc.cancel(id, actorOrgId);
  }
}
