import { Module }                  from '@nestjs/common';
import { PrismaService }           from '../../database/prisma.service';
import { ParkingGroupsService }    from './parking-groups.service';
import { ParkingGroupsController } from './parking-groups.controller';

@Module({
  providers:   [ParkingGroupsService, PrismaService],
  controllers: [ParkingGroupsController],
  exports:     [ParkingGroupsService],
})
export class ParkingGroupsModule {}
