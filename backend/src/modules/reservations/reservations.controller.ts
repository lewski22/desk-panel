import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard'; import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client'; import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateRecurringDto }   from './dto/create-recurring.dto';
import { CancelRecurringDto }   from './dto/cancel-recurring.dto';
@ApiTags('reservations') @Controller('reservations') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
export class ReservationsController {
  constructor(private svc: ReservationsService) {}
  @Get('my') @ApiOperation({summary:'My reservations'})
  findMy(@Request() req: any, @Query('date') date?: string, @Query('limit') limit?: string) {
    return this.svc.findMy(req.user.id,date,limit?parseInt(limit):50);
  }
  @Get() @UseGuards(RolesGuard) @Roles(UserRole.SUPER_ADMIN,UserRole.OFFICE_ADMIN,UserRole.STAFF) @ApiOperation({summary:'All reservations (staff)'})
  findAll(@Query() q: any, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.findAll({...q,actorOrgId});
  }
  @Get(':id') @ApiOperation({summary:'Get reservation'})
  findOne(@Param('id') id: string, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.findOne(id,actorOrgId);
  }
  @Get(':id/qr') @ApiOperation({summary:'Get QR token'})
  qr(@Param('id') id: string, @Request() req: any) { return this.svc.getQrToken(id,req.user.id); }
  @Post() @HttpCode(HttpStatus.CREATED) @ApiOperation({summary:'Create reservation'})
  create(@Body() dto: CreateReservationDto, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.create(req.user.id,dto,actorOrgId,req.user.role);
  }
  @Post('recurring') @HttpCode(HttpStatus.CREATED) @ApiOperation({summary:'Create recurring series'})
  createRecurring(@Body() body: CreateRecurringDto, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.createRecurring(req.user.id,body,actorOrgId);
  }
  @Post(':id/cancel-recurring') @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Cancel recurring'})
  cancelRecurring(@Param('id') id: string, @Body() body: CancelRecurringDto, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.cancelRecurring(id,body.scope,req.user.id,req.user.role,actorOrgId);
  }
  @Delete(':id') @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Cancel reservation'})
  cancel(@Param('id') id: string, @Request() req: any) {
    const actorOrgId=req.user.role==='OWNER'?undefined:req.user.organizationId;
    return this.svc.cancel(id,req.user.id,req.user.role,actorOrgId);
  }
}
