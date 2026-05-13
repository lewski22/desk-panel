import { Module } from '@nestjs/common';
import { ResourcesService }    from './resources.service';
import { ResourcesController } from './resources.controller';
import { PrismaService }       from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParkingGroupsModule } from '../parking-groups/parking-groups.module';
import { ParkingBlocksModule } from '../parking-blocks/parking-blocks.module';

@Module({
  imports:     [NotificationsModule, ParkingGroupsModule, ParkingBlocksModule],
  controllers: [ResourcesController],
  providers:   [ResourcesService, PrismaService],
  exports:     [ResourcesService],
})
export class ResourcesModule {}
