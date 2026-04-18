/**
 * SlackProvider — Sprint F2
 *
 * Wysyłanie powiadomień do Slack per organizacja.
 * Używa Slack Web API (chat.postMessage) z Bot Token.
 * Token szyfrowany w OrgIntegration.
 *
 * backend/src/modules/integrations/providers/slack.provider.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import type { SlackConfig }    from '../types/integration-config.types';

export interface SlackMessagePayload {
  event:        'reservation' | 'checkin' | 'beacon_alert' | 'gateway_alert';
  title:        string;
  body:         string;
  orgName?:     string;
  deskName?:    string;
  userName?:    string;
  locationName?: string;
  urgent?:      boolean;
}

@Injectable()
export class SlackProvider {
  private readonly logger = new Logger(SlackProvider.name);
  private readonly API_BASE = 'https://slack.com/api';

  constructor(private readonly integrations: IntegrationsService) {}

  /**
   * send — wysyła wiadomość do Slack.
   * Wywołaj z dowolnego serwisu (reservations, checkins, alerts).
   * Sprawdza isEnabled i odpowiedni flag notifyOn* przed wysłaniem.
   */
  async send(orgId: string, payload: SlackMessagePayload): Promise<void> {
    const cfg = await this.integrations.getDecryptedConfig<SlackConfig>(orgId, 'SLACK');
    if (!cfg?.botToken) return;

    // Sprawdź flagę notifyOn*
    if (payload.event === 'reservation'   && !cfg.notifyOnReservation)  return;
    if (payload.event === 'checkin'        && !cfg.notifyOnCheckin)       return;
    if (payload.event === 'beacon_alert'   && !cfg.notifyOnBeaconAlert)   return;
    if (payload.event === 'gateway_alert'  && !cfg.notifyOnGatewayAlert)  return;

    // Sprawdź isEnabled
    const integration = await this.integrations.findOne(orgId, 'SLACK');
    if (!integration?.isEnabled) return;

    const blocks = this._buildBlocks(payload);

    await this._post(cfg.botToken, {
      channel: cfg.defaultChannel,
      text:    payload.title, // fallback dla notyfikacji bez bloku
      blocks,
    });
  }

  /**
   * test — weryfikuje Bot Token i dostęp do kanału.
   */
  async test(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.integrations.getDecryptedConfig<SlackConfig>(orgId, 'SLACK');

    if (!cfg?.botToken) {
      return { ok: false, message: 'Brak Bot Token — skonfiguruj integrację Slack' };
    }
    if (!cfg.defaultChannel) {
      return { ok: false, message: 'Brak domyślnego kanału (#channel lub ID)' };
    }

    // Weryfikuj token przez auth.test
    try {
      const authResp = await this._call(cfg.botToken, 'auth.test', {});
      if (!authResp.ok) {
        return { ok: false, message: `Nieprawidłowy Bot Token: ${authResp.error ?? 'unknown'}` };
      }

      // Wyślij testową wiadomość
      const msgResp = await this._post(cfg.botToken, {
        channel: cfg.defaultChannel,
        text:    '✅ Reserti — test połączenia zakończony sukcesem',
      });

      if (!msgResp.ok) {
        return { ok: false, message: `Token OK, ale błąd wysyłki do kanału ${cfg.defaultChannel}: ${msgResp.error}` };
      }

      return {
        ok: true,
        message: `Połączono jako ${authResp.user} w workspace ${authResp.team}`,
      };
    } catch (err: any) {
      return { ok: false, message: `Błąd połączenia ze Slack: ${err.message}` };
    }
  }

  // ── Private helpers ───────────────────────────────────────────
  private _buildBlocks(payload: SlackMessagePayload): unknown[] {
    const emoji: Record<string, string> = {
      reservation: '📅',
      checkin:     '✅',
      beacon_alert: '🔴',
      gateway_alert: '⚠️',
    };

    const fields: unknown[] = [];
    if (payload.deskName)     fields.push({ type: 'mrkdwn', text: `*Biurko:*\n${payload.deskName}` });
    if (payload.userName)     fields.push({ type: 'mrkdwn', text: `*Użytkownik:*\n${payload.userName}` });
    if (payload.locationName) fields.push({ type: 'mrkdwn', text: `*Lokalizacja:*\n${payload.locationName}` });

    const blocks: unknown[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji[payload.event] ?? '🔔'} *${payload.title}*\n${payload.body}`,
        },
      },
    ];

    if (fields.length > 0) {
      blocks.push({ type: 'section', fields });
    }

    blocks.push({ type: 'divider' });
    return blocks;
  }

  private async _post(token: string, body: Record<string, unknown>): Promise<any> {
    return this._call(token, 'chat.postMessage', body);
  }

  private async _call(token: string, method: string, body: Record<string, unknown>): Promise<any> {
    const resp = await fetch(`${this.API_BASE}/${method}`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json; charset=utf-8',
      },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(8000),
    });
    return resp.json();
  }
}
