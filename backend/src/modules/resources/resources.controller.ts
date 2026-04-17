/**
 * ResourcesController — Sprint E2
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard';
import { RolesGuard }    from '../auth/guards/roles.guard';
import { Roles }         from '../auth/decorators/roles.decorator';
import { UserRole }      from '@prisma/client';
import { ResourcesService } from './resources.service';

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
  findAll(
    @Param('locationId') locationId: string,
    @Query('type')       type?:      string,
  ) {
    return this.svc.findAll(locationId, type);
  }

  @Post('locations/:locationId/resources')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create a new resource (room, parking spot, equipment)' })
  create(
    @Param('locationId') locationId: string,
    @Body()              body:       any,
  ) {
    return this.svc.create(locationId, body);
  }

  @Patch('resources/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update resource details' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete('resources/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a resource (sets status=INACTIVE)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // ── Availability ───────────────────────────────────────────
  @Get('resources/:id/availability')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Get resource availability for a date (30-min slots)' })
  availability(
    @Param('id')     id:   string,
    @Query('date')   date: string,
  ) {
    return this.svc.getAvailability(id, date);
  }

  // ── Bookings ───────────────────────────────────────────────
  @Post('resources/:id/bookings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'Book a resource' })
  book(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.svc.createBooking(id, req.user.id, body);
  }

  @Post('bookings/:id/cancel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.svc.cancelBooking(id, req.user.id, req.user.role);
  }

  @Get('users/me/bookings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.STAFF, UserRole.END_USER)
  @ApiOperation({ summary: 'My upcoming bookings (rooms, parking)' })
  myBookings(@Request() req: any, @Query('from') from?: string) {
    return this.svc.myBookings(req.user.id, from);
  }
}
