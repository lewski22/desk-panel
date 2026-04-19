/**
 * IntegrationsModule — Sprint F
 *
 * backend/src/modules/integrations/integrations.module.ts
 *
 * Dodaj do AppModule.imports:
 *   IntegrationsModule,
 *
 * IntegrationEventService jest exportowany i @Global() —
 * wstrzyknij go bezpośrednio do ReservationsService, CheckinsService itp.
 */
import { Module, Global }            from '@nestjs/common';
import { IntegrationCryptoService }  from './integration-crypto.service';
import { IntegrationsService }       from './integrations.service';
import { IntegrationsController }    from './integrations.controller';
import { IntegrationEventService }   from './integration-event.service';
import { AzureProvider }             from './providers/azure.provider';
import { SlackProvider }             from './providers/slack.provider';
import { GoogleProvider }            from './providers/google.provider';
import { TeamsProvider }             from './providers/teams.provider';
import { WebhookProvider }           from './providers/webhook.provider';

@Global() // IntegrationEventService dostępny globalnie (do wstrzykiwania w innych modułach)
@Module({
  controllers: [IntegrationsController],
  providers: [
    IntegrationCryptoService,
    IntegrationsService,
    IntegrationEventService,
    AzureProvider,
    SlackProvider,
    GoogleProvider,
    TeamsProvider,
    WebhookProvider,
  ],
  exports: [
    IntegrationsService,
    IntegrationEventService, // eksportuj żeby inne moduły mogły dispatch eventów
    IntegrationCryptoService,
    AzureProvider,
    GoogleProvider,
  ],
})
export class IntegrationsModule {}
