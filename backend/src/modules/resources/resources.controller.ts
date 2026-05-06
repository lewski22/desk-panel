/**
 * ResourcesController — Sprint E2 + ROOM-FIX (0.17.7)
 */
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request, HttpCode,
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
    return this.svc.findAll(locationId, type, date, req?.user?.organizationId);
  }

  @Post('locations/:locationId/resources')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Create a new resource (room, parking spot, equipment)' })
  create(
    @Param('locationId') locationId: string,
    @Body()              body:       CreateResourceDto,
  ) {
    return this.svc.create(locationId, body);
  }

  @Patch('resources/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN)
  @ApiOperation({ summary: 'Update resource details' })
  update(@Param('id') id: string, @Body() body: UpdateResourceDto) {
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
    @Request()       req:  any,
  ) {
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
  myBookings(@Request() req: any, @Query('from') from?: string) {
    return this.svc.myBookings(req.user.id, from);
  }
}
