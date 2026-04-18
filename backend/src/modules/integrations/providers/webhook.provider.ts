/**
 * WebhookProvider — Sprint F5
 *
 * Wysyłanie eventów do zewnętrznych URL per organizacja.
 * HMAC-SHA256 signature header: X-Reserti-Signature: sha256=<hex>
 * Retry: 3× z exponential backoff (5s, 30s, 120s).
 *
 * backend/src/modules/integrations/providers/webhook.provider.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHmac }          from 'crypto';
import { IntegrationsService } from '../integrations.service';
import type { WebhookCustomConfig, WebhookEvent } from '../types/integration-config.types';

export interface WebhookEventPayload {
  event:         WebhookEvent;
  organizationId: string;
  locationId?:   string;
  deskId?:       string;
  userId?:       string;
  data:          Record<string, unknown>;
  timestamp:     string; // ISO 8601
}

@Injectable()
export class WebhookProvider {
  private readonly logger = new Logger(WebhookProvider.name);
  private readonly BACKOFF_MS = [5_000, 30_000, 120_000]; // retry delays

  constructor(private readonly integrations: IntegrationsService) {}

  /**
   * dispatch — wysyła event do zarejestrowanego URL.
   * Sprawdza czy org ma włączony webhook i czy event jest subskrybowany.
   * Fire-and-forget z retry w tle.
   */
  async dispatch(orgId: string, payload: WebhookEventPayload): Promise<void> {
    const cfg = await this.integrations.getDecryptedConfig<WebhookCustomConfig>(orgId, 'WEBHOOK_CUSTOM');
    if (!cfg?.url) return;

    const integration = await this.integrations.findOne(orgId, 'WEBHOOK_CUSTOM');
    if (!integration?.isEnabled) return;

    // Sprawdź subskrypcję eventu
    if (cfg.events && !cfg.events.includes(payload.event)) return;

    // Wykonaj w tle — nie blokuj request path
    this._sendWithRetry(cfg, payload).catch(err => {
      this.logger.error(`Webhook dispatch failed for org=${orgId}: ${err.message}`);
    });
  }

  /**
   * test — wysyła testowy event ping do URL.
   */
  async test(orgId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.integrations.getDecryptedConfig<WebhookCustomConfig>(orgId, 'WEBHOOK_CUSTOM');

    if (!cfg?.url) {
      return { ok: false, message: 'Brak URL — skonfiguruj webhook' };
    }
    if (!cfg.secret) {
      return { ok: false, message: 'Brak signing secret' };
    }

    // Walidacja URL
    try {
      const parsed = new URL(cfg.url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return { ok: false, message: 'URL musi używać protokołu HTTPS lub HTTP' };
      }
    } catch {
      return { ok: false, message: `Nieprawidłowy URL: ${cfg.url}` };
    }

    const testPayload: WebhookEventPayload = {
      event:          'reservation.created',
      organizationId: orgId,
      data:           { test: true, message: 'Reserti webhook test' },
      timestamp:      new Date().toISOString(),
    };

    try {
      const result = await this._send(cfg, testPayload);
      if (result.ok) {
        return { ok: true, message: `Webhook odpowiedział HTTP ${result.status}` };
      }
      return { ok: false, message: `Webhook odpowiedział HTTP ${result.status} (oczekiwano 2xx)` };
    } catch (err: any) {
      return { ok: false, message: `Nie można połączyć z ${cfg.url}: ${err.message}` };
    }
  }

  // ── Private helpers ───────────────────────────────────────────
  private async _sendWithRetry(cfg: WebhookCustomConfig, payload: WebhookEventPayload): Promise<void> {
    const maxRetries = cfg.maxRetries ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._send(cfg, payload);
        if (result.ok) {
          if (attempt > 0) this.logger.log(`Webhook succeeded after ${attempt} retries`);
          return;
        }
        this.logger.warn(`Webhook HTTP ${result.status} (attempt ${attempt + 1}/${maxRetries + 1})`);
      } catch (err: any) {
        this.logger.warn(`Webhook error (attempt ${attempt + 1}): ${err.message}`);
      }

      if (attempt < maxRetries) {
        const delay = this.BACKOFF_MS[attempt] ?? 120_000;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    this.logger.error(`Webhook failed after ${maxRetries} retries for event ${payload.event}`);
  }

  private async _send(cfg: WebhookCustomConfig, payload: WebhookEventPayload): Promise<{ ok: boolean; status: number }> {
    const body = JSON.stringify(payload);
    const sig  = this._sign(cfg.secret, body);

    const headers: Record<string, string> = {
      'Content-Type':           'application/json',
      'X-Reserti-Signature':    `sha256=${sig}`,
      'X-Reserti-Event':        payload.event,
      'X-Reserti-Timestamp':    payload.timestamp,
      ...(cfg.headers ?? {}),   // custom headers z konfiguracji
    };

    const resp = await fetch(cfg.url, {
      method:  'POST',
      headers,
      body,
      signal:  AbortSignal.timeout(cfg.timeoutMs ?? 5000),
    });

    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status };
  }

  private _sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }
}
