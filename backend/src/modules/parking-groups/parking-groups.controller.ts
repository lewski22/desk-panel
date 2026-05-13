import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { Roles }              from '../auth/decorators/roles.decorator';
import { ParkingGroupsService } from './parking-groups.service';
import { CreateGroupDto }     from './dto/create-group.dto';
import { UpdateGroupDto }     from './dto/update-group.dto';
import { AddUserDto }         from './dto/add-user.dto';
import { AddUsersBulkDto }    from './dto/add-users-bulk.dto';
import { SetResourcesDto }    from './dto/set-resources.dto';
import { SetAccessModeDto }   from './dto/set-access-mode.dto';

@ApiTags('parking-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parking-groups')
export class ParkingGroupsController {
  constructor(private svc: ParkingGroupsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  @ApiOperation({ summary: 'List parking groups for organization' })
  findAll(@Request() req: any) {
    return this.svc.findAll(req.user.organizationId);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Get parking group with members and resources' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Create parking group' })
  create(@Body() dto: CreateGroupDto, @Request() req: any) {
    return this.svc.create(req.user.organizationId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Update parking group' })
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto, @Request() req: any) {
    return this.svc.update(id, req.user.organizationId, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete parking group' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.remove(id, req.user.organizationId);
  }

  // ── Członkowie ──────────────────────────────────────────────
  @Post(':id/users')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Add user to parking group' })
  addUser(@Param('id') id: string, @Body() dto: AddUserDto, @Request() req: any) {
    return this.svc.addUser(id, req.user.organizationId, dto.userId, req.user.id);
  }

  @Post(':id/users/bulk')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Bulk add users to parking group' })
  addUsersBulk(@Param('id') id: string, @Body() dto: AddUsersBulkDto, @Request() req: any) {
    return this.svc.addUsersBulk(id, req.user.organizationId, dto.userIds, req.user.id);
  }

  @Delete(':id/users/:userId')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove user from parking group' })
  removeUser(@Param('id') id: string, @Param('userId') userId: string, @Request() req: any) {
    return this.svc.removeUser(id, req.user.organizationId, userId);
  }

  // ── Parkingi grupy ──────────────────────────────────────────
  @Put(':id/resources')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Set parking resources assigned to group (replaces existing)' })
  setResources(@Param('id') id: string, @Body() dto: SetResourcesDto, @Request() req: any) {
    return this.svc.setResources(id, req.user.organizationId, dto.resourceIds, req.user.id);
  }

  // ── Access mode parkingu ────────────────────────────────────
  @Patch('resources/:resourceId/access-mode')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN')
  @ApiOperation({ summary: 'Set parking resource access mode (org-scoped)' })
  setAccessMode(@Param('resourceId') resourceId: string, @Body() dto: SetAccessModeDto, @Request() req: any) {
    return this.svc.setAccessMode(resourceId, req.user.organizationId, dto.accessMode);
  }
}
