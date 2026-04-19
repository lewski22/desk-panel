/**
 * TeamsProvider — Sprint F4
 *
 * Wysyłanie powiadomień do Microsoft Teams przez Incoming Webhook.
 * Nie wymaga App Registration ani Bot Framework — konfiguracja w 1 minutę.
 * Używa Adaptive Card format.
 *
 * backend/src/modules/integrations/providers/teams.provider.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import type { MicrosoftTeamsConfig } from '../types/integration-config.types';

export interface TeamsMessagePayload {
  event:        'reservation' | 'checkin' | 'beacon_alert' | 'gateway_alert';
  title:        string;
  body:         string;
  deskName?:    string;
  userName?:    string;
  locationName?: string;
  urgent?:      boolean;
}

@Injectable()
export class TeamsProvider {
  private readonly logger = new Logger(TeamsProvider.name);

  constructor(private readonly integrations: IntegrationsService) {}

  /**
   * send — wysyła Adaptive Card do Teams.
   */
  async send(orgId: string, payload: TeamsMessagePayload): Promise<void> {
    const cfg = await this.integrations.getDecryptedConfig<MicrosoftTeamsConfig>(orgId, 'MICROSOFT_TEAMS');
    if (!cfg?.incomingWebhookUrl) return;

    const integration = await this.integrations.findOne(orgId, 'MICROSOFT_TEAMS');
    if (!integration?.isEnabled) return;

    // Sprawdź flagi notifikacji
    if (payload.event === 'reservation'  && !cfg.notifyOnReservation)  return;
    if (payload.event === 'checkin'       && !cfg.notifyOnCheckin)       return;
    if (payload.event === 'beacon_alert'  && !cfg.notifyOnBeaconAlert)   return;
    if (payload.event === 'gateway_alert' && !cfg.notifyOnGatewayAlert)  return;

    const card = this._buildAdaptiveCard(payload);

    try {
      await fetch(cfg.incomingWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] }),
        signal:  AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      this.logger.warn(`Teams send failed for org=${orgId}: ${err.message}`);
    }
  }

  /**
   * test — wysyła testową wiadomość do kanału Teams.
   */
  async test(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.integrations.getDecryptedConfig<MicrosoftTeamsConfig>(orgId, 'MICROSOFT_TEAMS');

    if (!cfg?.incomingWebhookUrl) {
      return { ok: false, message: 'Brak Incoming Webhook URL — skonfiguruj Connector w Teams' };
    }

    // Walidacja URL
    if (!cfg.incomingWebhookUrl.startsWith('https://') ||
        !cfg.incomingWebhookUrl.includes('webhook.office.com')) {
      return {
        ok: false,
        message: 'Nieprawidłowy URL Incoming Webhook (powinien zawierać webhook.office.com)',
      };
    }

    const testCard = this._buildAdaptiveCard({
      event: 'reservation',
      title: '✅ Reserti — test połączenia',
      body:  'Integracja z Microsoft Teams działa poprawnie.',
    });

    try {
      const resp = await fetch(cfg.incomingWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type: 'message',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: testCard,
          }],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return { ok: false, message: `Teams odpowiedział HTTP ${resp.status}: ${text.slice(0, 100)}` };
      }

      return { ok: true, message: 'Testowa wiadomość wysłana do Teams' };
    } catch (err: any) {
      return { ok: false, message: `Nie można połączyć z Teams: ${err.message}` };
    }
  }

  // ── Adaptive Card builder ─────────────────────────────────────
  private _buildAdaptiveCard(payload: TeamsMessagePayload): unknown {
    const accentColor: Record<string, string> = {
      reservation:   'accent',
      checkin:       'good',
      beacon_alert:  'attention',
      gateway_alert: 'warning',
    };

    const facts: Array<{ title: string; value: string }> = [];
    if (payload.deskName)     facts.push({ title: 'Biurko',       value: payload.deskName });
    if (payload.userName)     facts.push({ title: 'Użytkownik',   value: payload.userName });
    if (payload.locationName) facts.push({ title: 'Lokalizacja',  value: payload.locationName });

    const body: unknown[] = [
      {
        type:   'TextBlock',
        text:   payload.title,
        weight: 'bolder',
        size:   'medium',
        color:  accentColor[payload.event] ?? 'default',
        wrap:   true,
      },
      {
        type: 'TextBlock',
        text: payload.body,
        wrap: true,
      },
    ];

    if (facts.length > 0) {
      body.push({
        type:  'FactSet',
        facts,
      });
    }

    return {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type:    'AdaptiveCard',
      version: '1.4',
      body,
    };
  }
}
