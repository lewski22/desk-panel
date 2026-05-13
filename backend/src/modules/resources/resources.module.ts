import { Module } from '@nestjs/common';
import { ResourcesService }    from './resources.service';
import { ResourcesController } from './resources.controller';
import { PrismaService }       from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [NotificationsModule],
  controllers: [ResourcesController],
  providers:   [ResourcesService, PrismaService],
  exports:     [ResourcesService],
})
export class ResourcesModule {}
