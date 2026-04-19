/**
 * GraphService — Sprint F (M4)
 *
 * Microsoft Graph API — synchronizacja kalendarza Outlook ↔ Reserti.
 *
 * Architektura:
 *   1. User autoryzuje dostęp do kalendarza (OAuth2 delegated, /auth/graph/redirect)
 *   2. Token przechowywany w GraphToken (AES-256-GCM)
 *   3. Przy tworzeniu rezerwacji → utwórz event w Outlook
 *   4. Przy anulowaniu → usuń event
 *   5. Webhook Microsoft Graph → gdy user zmieni event w Outlook → sync do Reserti
 *   6. Cron co 24h → odnów subskrypcje webhook (max TTL 3 dni)
 *
 * backend/src/modules/graph-sync/graph.service.ts
 */
import { Injectable, Logger }     from '@nestjs/common';
import { Cron }                   from '@nestjs/schedule';
import { ConfigService }          from '@nestjs/config';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService }          from '../../database/prisma.service';
import { IntegrationCryptoService } from '../integrations/integration-crypto.service';
import { IntegrationsService }    from '../integrations/integrations.service';
import type { AzureEntraConfig }  from '../integrations/types/integration-config.types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const CALENDAR_SCOPE = 'Calendars.ReadWrite offline_access User.Read';
// Microsoft Graph webhook: max TTL 4230 minut ≈ 2.9 dni dla kalendarza
const SUB_TTL_HOURS = 70; // 70h — renewujemy co 24h

export interface CalendarEventInput {
  reservationId: string;
  subject:       string;
  start:         Date;
  end:           Date;
  location?:     string;
  bodyText?:     string;
  organizerId?:  string;
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly crypto:       IntegrationCryptoService,
    private readonly integrations: IntegrationsService,
    private readonly config:       ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  /**
   * getAccessToken — pobierz ważny access token dla usera.
   * Automatycznie odświeża jeśli wygasł.
   * Zwraca null jeśli user nie autoryzował dostępu.
   */
  async getAccessToken(userId: string): Promise<string | null> {
    const record = await (this.prisma as any).graphToken.findUnique({
      where: { userId },
    });
    if (!record) return null;

    // Sprawdź czy token ważny (margines 5 min)
    const expiresAt = new Date(record.expiresAt);
    if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
      return this.crypto.tryDecrypt(record.accessTokenEnc);
    }

    // Refresh token
    return this._refreshAccessToken(userId, record);
  }

  /**
   * saveTokens — zapisz tokeny po OAuth2 callback.
   */
  async saveTokens(
    userId:       string,
    orgId:        string,
    accessToken:  string,
    refreshToken: string,
    expiresIn:    number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await (this.prisma as any).graphToken.upsert({
      where:  { userId },
      update: {
        accessTokenEnc:  this.crypto.encrypt(accessToken),
        refreshTokenEnc: this.crypto.encrypt(refreshToken),
        expiresAt,
        updatedAt:       new Date(),
      },
      create: {
        userId,
        organizationId:  orgId,
        accessTokenEnc:  this.crypto.encrypt(accessToken),
        refreshTokenEnc: this.crypto.encrypt(refreshToken),
        expiresAt,
        scope:           CALENDAR_SCOPE,
      },
    });
    this.logger.log(`Graph tokens saved for user=${userId}`);
  }

  /**
   * disconnectUser — usuń tokeny i subskrypcje (disconnect Graph).
   */
  async disconnectUser(userId: string): Promise<void> {
    // Usuń subskrypcje webhook z Microsoft
    const subs = await (this.prisma as any).graphSubscription.findMany({ where: { userId } });
    for (const sub of subs) {
      await this._deleteSubscription(userId, sub.subscriptionId).catch(() => {});
    }

    // Usuń z DB
    await (this.prisma as any).graphToken.deleteMany({ where: { userId } });
    await (this.prisma as any).graphSubscription.deleteMany({ where: { userId } });
    this.logger.log(`Graph disconnected for user=${userId}`);
  }

  /**
   * isConnected — czy user ma autoryzowany dostęp do Graph.
   */
  async isConnected(userId: string): Promise<boolean> {
    const record = await (this.prisma as any).graphToken.findUnique({
      where:  { userId },
      select: { id: true },
    });
    return !!record;
  }

  // ══════════════════════════════════════════════════════════════
  // CALENDAR CRUD
  // ══════════════════════════════════════════════════════════════

  /**
   * createCalendarEvent — utwórz event w kalendarzu Outlook usera.
   * Zwraca Microsoft Graph event ID (do zapisania w Reservation.graphEventId).
   */
  async createCalendarEvent(userId: string, input: CalendarEventInput): Promise<string | null> {
    const token = await this.getAccessToken(userId);
    if (!token) return null;

    const body = {
      subject:   input.subject,
      body: {
        contentType: 'HTML',
        content:     input.bodyText
          ? `<p>${input.bodyText}</p><p style="color:#666;font-size:12px">Rezerwacja ID: ${input.reservationId} · zarządzaj przez Reserti</p>`
          : `<p>Rezerwacja biurka zarządzana przez Reserti</p><p style="font-size:12px;color:#666">ID: ${input.reservationId}</p>`,
      },
      start: {
        dateTime: input.start.toISOString(),
        timeZone: 'Europe/Warsaw',
      },
      end: {
        dateTime: input.end.toISOString(),
        timeZone: 'Europe/Warsaw',
      },
      location: input.location ? { displayName: input.location } : undefined,
      // Oznacz że event pochodzi z Reserti
      categories: ['Reserti'],
      // Transakcyjny identifier — pozwala na idempotentne tworzenie
      transactionId: input.reservationId,
    };

    try {
      const resp = await this._graphPost(token, '/me/events', body);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as any;
        this.logger.warn(`Graph createEvent failed user=${userId}: ${err.error?.message ?? resp.status}`);
        return null;
      }
      const data = await resp.json() as any;
      this.logger.log(`Graph event created: ${data.id} for reservation=${input.reservationId}`);
      return data.id as string;
    } catch (err: any) {
      this.logger.warn(`Graph createEvent error: ${err.message}`);
      return null;
    }
  }

  /**
   * updateCalendarEvent — zaktualizuj istniejący event (np. zmiana godzin).
   */
  async updateCalendarEvent(userId: string, graphEventId: string, input: Partial<CalendarEventInput>): Promise<boolean> {
    const token = await this.getAccessToken(userId);
    if (!token) return false;

    const patch: any = {};
    if (input.subject)   patch.subject = input.subject;
    if (input.start)     patch.start   = { dateTime: input.start.toISOString(), timeZone: 'Europe/Warsaw' };
    if (input.end)       patch.end     = { dateTime: input.end.toISOString(),   timeZone: 'Europe/Warsaw' };
    if (input.location)  patch.location = { displayName: input.location };

    try {
      const resp = await this._graphPatch(token, `/me/events/${graphEventId}`, patch);
      return resp.ok;
    } catch { return false; }
  }

  /**
   * deleteCalendarEvent — usuń event z kalendarza Outlook.
   */
  async deleteCalendarEvent(userId: string, graphEventId: string): Promise<boolean> {
    const token = await this.getAccessToken(userId);
    if (!token) return false;

    try {
      const resp = await fetch(`${GRAPH_BASE}/me/events/${graphEventId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal:  AbortSignal.timeout(8000),
      });
      // 204 No Content = sukces; 404 = już nie istnieje (też OK)
      return resp.status === 204 || resp.status === 404;
    } catch { return false; }
  }

  // ══════════════════════════════════════════════════════════════
  // WEBHOOK SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * createSubscription — zarejestruj webhook dla kalendarza usera.
   * Microsoft Graph powiadomi backend przy każdej zmianie eventu.
   */
  async createSubscription(userId: string): Promise<boolean> {
    const token = await this.getAccessToken(userId);
    if (!token) return false;

    const clientState = randomBytes(16).toString('hex');
    const expiresAt   = new Date(Date.now() + SUB_TTL_HOURS * 3600 * 1000);

    const notificationUrl = `${this.config.get('PUBLIC_API_URL', 'https://api.prohalw2026.ovh/api/v1')}/graph/webhook`;

    try {
      const resp = await this._graphPost(token, '/subscriptions', {
        changeType:          'created,updated,deleted',
        notificationUrl,
        resource:            'me/events',
        expirationDateTime:  expiresAt.toISOString(),
        clientState,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as any;
        this.logger.warn(`Graph subscription create failed user=${userId}: ${err.error?.message}`);
        return false;
      }

      const data = await resp.json() as any;

      await (this.prisma as any).graphSubscription.upsert({
        where:  { subscriptionId: data.id },
        update: { expiresAt: new Date(data.expirationDateTime), clientState },
        create: {
          userId,
          subscriptionId: data.id,
          calendarId:     'primary',
          expiresAt:      new Date(data.expirationDateTime),
          clientState,
        },
      });

      this.logger.log(`Graph subscription created: ${data.id} for user=${userId}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Graph subscription error: ${err.message}`);
      return false;
    }
  }

  /**
   * processWebhookNotification — obsłuż notyfikację od Microsoft Graph.
   * Weryfikuje clientState, pobiera zmieniony event, syncuje z Reserti.
   * Przy błędzie przejściowym — jeden retry po 1s.
   */
  async processWebhookNotification(notifications: any[]): Promise<void> {
    for (const notification of notifications) {
      try {
        await this._processOne(notification);
      } catch (err: any) {
        this.logger.warn(`Webhook processing error (retrying): ${err.message}`);
        await new Promise(r => setTimeout(r, 1000));
        try {
          await this._processOne(notification);
        } catch (err2: any) {
          this.logger.error(`Webhook processing failed after retry: ${err2.message}`);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CRON: Subscription renewal
  // ══════════════════════════════════════════════════════════════

  /**
   * Cron: co 24h odnów subskrypcje których TTL < 48h.
   * Microsoft Graph wymaga odnowienia przed wygaśnięciem.
   */
  @Cron('0 6 * * *', { name: 'graph-subscription-renewal' })
  async renewExpiringSubscriptions(): Promise<void> {
    const threshold = new Date(Date.now() + 48 * 3600 * 1000);

    const expiring = await (this.prisma as any).graphSubscription.findMany({
      where: { expiresAt: { lt: threshold } },
    });

    this.logger.log(`[Graph] Renewing ${expiring.length} subscription(s)`);

    for (const sub of expiring) {
      const token = await this.getAccessToken(sub.userId);
      if (!token) {
        // User odwołał dostęp — usuń subskrypcję
        await (this.prisma as any).graphSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        continue;
      }

      const newExpiry = new Date(Date.now() + SUB_TTL_HOURS * 3600 * 1000);

      try {
        const resp = await this._graphPatch(token, `/subscriptions/${sub.subscriptionId}`, {
          expirationDateTime: newExpiry.toISOString(),
        });

        if (resp.ok) {
          await (this.prisma as any).graphSubscription.update({
            where: { id: sub.id },
            data:  { expiresAt: newExpiry },
          });
          this.logger.log(`Graph subscription renewed: ${sub.subscriptionId}`);
        } else {
          this.logger.warn(`Graph subscription renewal failed: ${sub.subscriptionId} HTTP ${resp.status}`);
        }
      } catch (err: any) {
        this.logger.warn(`Graph renewal error: ${err.message}`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private async _processOne(notification: any): Promise<void> {
    // 1. Waliduj clientState
    const sub = await (this.prisma as any).graphSubscription.findUnique({
      where:  { subscriptionId: notification.subscriptionId },
      select: { clientState: true, userId: true },
    });
    if (!sub || sub.clientState !== notification.clientState) {
      this.logger.warn(`Invalid clientState in webhook notification`);
      return;
    }

    // 2. Pobierz zmieniony event z Graph
    const changeType: string = notification.changeType; // created | updated | deleted
    const resourceUrl: string = notification.resourceData?.['@odata.id'] ?? '';

    if (changeType === 'deleted') {
      // Event usunięty w Outlook → sprawdź czy to nasza rezerwacja
      await this._handleExternalDelete(notification.resourceData?.id, sub.userId);
      return;
    }

    if (!resourceUrl) return;

    const token = await this.getAccessToken(sub.userId);
    if (!token) return;

    // Pobierz pełny event
    const resp = await fetch(`${GRAPH_BASE}${resourceUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(8000),
    });
    if (!resp.ok) return;

    const event = await resp.json() as any;

    // Sprawdź czy event pochodzi z Reserti (by transactionId lub categories)
    const isReserti = event.categories?.includes('Reserti') ||
                      event.transactionId?.startsWith('c'); // cuid prefix

    if (!isReserti) return; // Ignoruj zewnętrzne eventy

    // Sync: jeśli user zmienił czas → zaktualizuj rezerwację w Reserti
    if (changeType === 'updated' && event.transactionId) {
      await this._syncEventToReservation(event, sub.userId);
    }
  }

  private async _handleExternalDelete(graphEventId: string, userId: string): Promise<void> {
    if (!graphEventId) return;

    const reservation = await this.prisma.reservation.findFirst({
      where: { graphEventId, userId },
    });
    if (!reservation) return;

    // User usunął event w Outlook → anuluj rezerwację w Reserti
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data:  { status: 'CANCELLED' as any },
    });
    this.logger.log(`Reservation ${reservation.id} cancelled via Graph webhook (external delete)`);
  }

  private async _syncEventToReservation(event: any, _userId: string): Promise<void> {
    const reservationId = event.transactionId;
    if (!reservationId) return;

    const newStart = new Date(event.start?.dateTime);
    const newEnd   = new Date(event.end?.dateTime);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) return;
    if (newEnd <= newStart) return;

    // Pobierz rezerwację żeby znać deskId
    const reservation = await this.prisma.reservation.findUnique({
      where:  { id: reservationId },
      select: { id: true, deskId: true, status: true },
    });
    if (!reservation || !['PENDING', 'CONFIRMED'].includes(reservation.status)) return;

    // Sprawdź konflikt z innymi rezerwacjami na tym biurku
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        deskId:    reservation.deskId,
        id:        { not: reservationId },
        status:    { in: ['PENDING', 'CONFIRMED'] as any },
        startTime: { lt: newEnd },
        endTime:   { gt: newStart },
      },
    });

    if (conflict) {
      this.logger.warn(`Graph webhook: time change for reservation=${reservationId} conflicts with ${conflict.id} — skipped`);
      return;
    }

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data:  { startTime: newStart, endTime: newEnd },
    }).catch(() => {});

    this.logger.log(`Reservation ${reservationId} times updated via Graph webhook`);
  }

  private async _refreshAccessToken(userId: string, record: any): Promise<string | null> {
    const refreshToken = this.crypto.tryDecrypt(record.refreshTokenEnc);
    if (!refreshToken) return null;

    // Pobierz konfigurację Azure per org
    const azureCfg = await this.integrations.getAzureConfig(record.organizationId);
    if (!azureCfg?.tenantId) return null;

    const clientId     = (azureCfg.clientId     ?? this.config.get('AZURE_CLIENT_ID', '')) as string;
    const clientSecret = (azureCfg.clientSecret  ?? this.config.get('AZURE_CLIENT_SECRET', '')) as string;

    const body = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      scope:         CALENDAR_SCOPE,
    });

    try {
      const resp = await fetch(
        `https://login.microsoftonline.com/${azureCfg.tenantId}/oauth2/v2.0/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(10_000) },
      );

      if (!resp.ok) {
        this.logger.warn(`Graph token refresh failed for user=${userId}: HTTP ${resp.status}`);
        return null;
      }

      const data = await resp.json() as any;
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

      await (this.prisma as any).graphToken.update({
        where: { userId },
        data:  {
          accessTokenEnc:  this.crypto.encrypt(data.access_token),
          refreshTokenEnc: data.refresh_token ? this.crypto.encrypt(data.refresh_token) : record.refreshTokenEnc,
          expiresAt,
          updatedAt:       new Date(),
        },
      });

      return data.access_token as string;
    } catch (err: any) {
      this.logger.warn(`Graph token refresh error: ${err.message}`);
      return null;
    }
  }

  private async _deleteSubscription(userId: string, subscriptionId: string): Promise<void> {
    const token = await this.getAccessToken(userId);
    if (!token) return;
    await fetch(`${GRAPH_BASE}/subscriptions/${subscriptionId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  private _graphPost(token: string, path: string, body: unknown): Promise<Response> {
    return fetch(`${GRAPH_BASE}${path}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    });
  }

  private _graphPatch(token: string, path: string, body: unknown): Promise<Response> {
    return fetch(`${GRAPH_BASE}${path}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    });
  }
}
