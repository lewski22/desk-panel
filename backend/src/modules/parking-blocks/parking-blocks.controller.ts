import {
  Controller, Get, Post, Delete, Body, Param, Query,
  Request, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard }         from '../auth/guards/jwt-auth.guard';
import { RolesGuard }           from '../auth/guards/roles.guard';
import { Roles }                from '../auth/decorators/roles.decorator';
import { ParkingBlocksService } from './parking-blocks.service';
import { CreateBlockDto }       from './dto/create-block.dto';

@ApiTags('parking-blocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parking-blocks')
export class ParkingBlocksController {
  constructor(private svc: ParkingBlocksService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  findAll(
    @Query('resourceId') resourceId: string,
    @Query('groupId')    groupId: string,
    @Query('from')       from: string,
    @Query('to')         to: string,
    @Request() req: any,
  ) {
    return this.svc.findAll({
      resourceId: resourceId || undefined,
      groupId:    groupId    || undefined,
      from:       from       || undefined,
      to:         to         || undefined,
      orgId:      req.user.organizationId,
    });
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  create(@Body() dto: CreateBlockDto, @Request() req: any) {
    if (req.user.role === 'STAFF' && dto.groupId) {
      throw new ForbiddenException('STAFF cannot block groups');
    }
    return this.svc.create({ ...dto, createdBy: req.user.id, orgId: req.user.organizationId });
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'STAFF')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.remove(id, req.user.organizationId);
  }
}
