import { Module } from '@nestjs/common'; import { ScheduleModule } from '@nestjs/schedule';
import { InAppNotificationsService } from './inapp-notifications.service';
import { InAppNotificationsController } from './inapp-notifications.controller';
// IntegrationsModule is @Global
@Module({ imports:[ScheduleModule.forRoot()], providers:[InAppNotificationsService], controllers:[InAppNotificationsController], exports:[InAppNotificationsService] })
export class InAppNotificationsModule {}
