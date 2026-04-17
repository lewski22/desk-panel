import { Module }                    from '@nestjs/common';
import { SubscriptionsService }      from './subscriptions.service';
import { SubscriptionsController }   from './subscriptions.controller';
import { PrismaService }             from '../../database/prisma.service';
import { InAppNotificationsModule }  from '../inapp-notifications/inapp-notifications.module';
import { NotificationsModule }       from '../notifications/notifications.module';

@Module({
  imports:     [InAppNotificationsModule, NotificationsModule],
  controllers: [SubscriptionsController],
  providers:   [SubscriptionsService, PrismaService],
  exports:     [SubscriptionsService],
})
export class SubscriptionsModule {}
