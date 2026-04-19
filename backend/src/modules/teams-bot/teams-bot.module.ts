import { Module }              from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
} from '@microsoft/botbuilder';
import { TeamsBotController } from './teams-bot.controller';
import { TeamsBotService }    from './teams-bot.service';

@Module({
  imports: [ConfigModule],
  controllers: [TeamsBotController],
  providers: [
    {
      provide:    CloudAdapter,
      useFactory: (config: ConfigService) => {
        const appId       = config.get<string>('BOT_APP_ID', '');
        const appPassword = config.get<string>('BOT_APP_PASSWORD', '');

        const credFactory = new ConfigurationServiceClientCredentialFactory({
          MicrosoftAppId:       appId,
          MicrosoftAppPassword: appPassword,
          MicrosoftAppType:     'MultiTenant',
        });

        const auth = new ConfigurationBotFrameworkAuthentication({}, credFactory);
        const adapter = new CloudAdapter(auth);

        adapter.onTurnError = async (context, error) => {
          console.error('[TeamsBot] Unhandled error:', error);
          await context.sendActivity('Wystąpił błąd. Spróbuj ponownie.').catch(() => {});
        };

        return adapter;
      },
      inject: [ConfigService],
    },
    TeamsBotService,
  ],
})
export class TeamsBotModule {}
