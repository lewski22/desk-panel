/**
 * SubscriptionsController — Sprint B
 */
import {
  Controller, Get, Post, Param, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { Roles }                 from '../auth/decorators/roles.decorator';
import { UserRole }              from '@prisma/client';
import { SubscriptionsService }  from './subscriptions.service';
import { OwnerGuard }            from '../owner/guards/owner.guard';

@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  // ── SUPER_ADMIN — własna org ─────────────────────────────────
  @Get('subscription/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Get subscription status for current organization' })
  getStatus(@Request() req: any) {
    return this.svc.getStatus(req.user.organizationId);
  }

  // ── OWNER — zarządzanie klientami ────────────────────────────
  @Get('owner/organizations/:id/subscription')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get subscription status for specific org (Owner)' })
  getOrgStatus(@Param('id') id: string) {
    return this.svc.getStatus(id);
  }

  @Post('owner/organizations/:id/subscription')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update plan for specific org (Owner)' })
  updatePlan(
    @Param('id')  id:   string,
    @Body()       body: any,
    @Request()    req:  any,
  ) {
    return this.svc.updatePlan(id, body, req.user.id);
  }

  @Get('owner/organizations/:id/subscription/events')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get subscription event history for org (Owner)' })
  getEvents(@Param('id') id: string) {
    return this.svc.getEvents(id);
  }

  @Get('owner/subscription/dashboard')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Owner MRR dashboard — all orgs summary' })
  getDashboard() {
    return this.svc.getDashboard();
  }
}
