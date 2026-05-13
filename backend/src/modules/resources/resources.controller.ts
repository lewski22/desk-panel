/**
 * ResourcesController — Sprint E2 + ROOM-FIX (0.17.7)
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard';
import { RolesGuard }    from '../auth/guards/roles.guard';
import { Roles }         from '../auth/decorators/roles.decorator';
import { UserRole }      from '@prisma/client';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { CreateBookingDto }  from './dto/create-booking.dto';

function validateDate(date: string | undefined): void {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestException('Invalid date format — expected YYYY-MM-DD');
  }
}

@ApiTags('resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ResourcesController {
  constructor(private readonly svc: ResourcesService) {}

  // ── Resources CRUD ─────────────────────────────────────────
  @Get('locations/:locationId/resources')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'List resources (rooms, parking, equipment) for a location' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-01' })
  findAll(
    @Param('locationId') locationId: string,
    @Query('type')       type?:      string,
    @Query('date')       date?:      string,
    @Request()           req?:       any,
  ) {
    return this.svc.findAll(locationId, type, date, req?.user?.organizationId, req?.user?.id);
  }

  @Post('locations/:locationId/resources')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create a new resource (room, parking spot, equipment)' })
  create(
    @Param('locationId') locationId: string,
    @Body()              body:       CreateResourceDto,
    @Request()           req:        any,
  ) {
    return this.svc.create(locationId, body, req.user.organizationId);
  }

  @Patch('resources/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update resource details' })
  update(@Param('id') id: string, @Body() body: UpdateResourceDto, @Request() req: any) {
    return this.svc.update(id, body, req.user.organizationId);
  }

  @Delete('resources/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a resource (sets status=INACTIVE)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.remove(id, req.user.organizationId);
  }

  // ── Availability ───────────────────────────────────────────
  @Get('resources/:id/availability')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Get resource availability for a date (30-min slots)' })
  availability(
    @Param('id')     id:   string,
    @Query('date')   date: string,
    @Request()       req:  any,
  ) {
    validateDate(date);
    return this.svc.getAvailability(id, date, req.user.organizationId);
  }

  // ── Bookings ───────────────────────────────────────────────
  @Post('resources/:id/bookings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Book a resource' })
  book(@Param('id') id: string, @Body() body: CreateBookingDto, @Request() req: any) {
    return this.svc.createBooking(id, req.user.id, req.user.role, body, req.user.organizationId);
  }

  @Post('bookings/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.svc.cancelBooking(id, req.user.id, req.user.role, req.user.organizationId);
  }

  @Get('users/me/bookings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'My upcoming bookings (rooms, parking)' })
  myBookings(
    @Request()               req:            any,
    @Query('from')           from?:          string,
    @Query('includeHistory') includeHistory?: string,
  ) {
    validateDate(from);
    return this.svc.myBookings(req.user.id, from, includeHistory === 'true');
  }

  @Get('bookings/admin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'All bookings — admin view (rooms, parking)' })
  allBookings(
    @Request()           req:         any,
    @Query('date')       date?:       string,
    @Query('locationId') locationId?: string,
    @Query('type')       type?:       string,
  ) {
    validateDate(date);
    // OWNER is the platform-level super-user role; undefined actorOrgId lets them see all orgs (intentional)
    const actorOrgId = req.user.role === 'OWNER' ? undefined : req.user.organizationId;
    return this.svc.allBookings({ actorOrgId, date, locationId, type });
  }
}
