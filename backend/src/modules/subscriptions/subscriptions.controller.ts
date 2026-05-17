/**
 * SubscriptionsController — Sprint B
 */
import {
  Controller, Get, Post, Put, Param, Body, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }          from '../auth/guards/jwt-auth.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { Roles }                 from '../auth/decorators/roles.decorator';
import { UserRole }              from '@prisma/client';
import { SubscriptionsService }      from './subscriptions.service';
import { UpdatePlanDto }             from './dto/update-plan.dto';
import { UpdatePlanTemplateDto }     from './dto/update-plan-template.dto';
import { MarkInvoiceSentDto, MarkInvoicePaidDto } from './dto/mark-invoice.dto';
import { SetHardwarePricingDto }                  from './dto/set-hardware-pricing.dto';
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
    @Body()       body: UpdatePlanDto,
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

  @Get('owner/subscription/plans')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get all plan templates (Owner)' })
  getPlanTemplates() {
    return this.svc.getPlanTemplates();
  }

  @Put('owner/subscription/plans/:plan')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update plan template globally (Owner)' })
  updatePlanTemplate(
    @Param('plan') plan: string,
    @Body()        body: UpdatePlanTemplateDto,
  ) {
    return this.svc.updatePlanTemplate(plan, body);
  }

  @Get('owner/subscription/log')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Global subscription event log cross-org (Owner)' })
  getGlobalLog(
    @Query('limit')  limit?:  string,
    @Query('offset') offset?: string,
    @Query('orgId')  orgId?:  string,
    @Query('type')   type?:   string,
  ) {
    return this.svc.getGlobalLog({
      limit:  limit  ? parseInt(limit,  10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
      orgId,
      type,
    });
  }

  @Post('owner/organizations/:id/invoice/sent')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Mark invoice as sent for org (Owner)' })
  markInvoiceSent(
    @Param('id') id:   string,
    @Body()      body: MarkInvoiceSentDto,
    @Request()   req:  any,
  ) {
    return this.svc.markInvoiceSent(id, { ...body, changedBy: req.user.id });
  }

  @Post('owner/organizations/:id/invoice/paid')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Mark invoice as paid for org (Owner)' })
  markInvoicePaid(
    @Param('id') id:   string,
    @Body()      body: MarkInvoicePaidDto,
    @Request()   req:  any,
  ) {
    return this.svc.markInvoicePaid(id, { ...body, changedBy: req.user.id });
  }

  // ── Hardware pricing ──────────────────────────────────────────

  @Get('owner/subscription/hardware-pricing')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Get hardware pricing (beacon price per unit)' })
  getHardwarePricing() {
    return this.svc.getHardwarePricing();
  }

  @Put('owner/subscription/hardware-pricing')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set hardware pricing (beacon price per unit)' })
  setHardwarePricing(@Body() body: SetHardwarePricingDto) {
    return this.svc.setHardwarePricing(body);
  }
}
