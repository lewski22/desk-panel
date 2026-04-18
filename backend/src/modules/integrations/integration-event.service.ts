/**
 * IntegrationEventService — Sprint F
 *
 * Centralny dispatcher eventów do wszystkich aktywnych providerów.
 * Wstrzyknij do ReservationsService, CheckinsService i AlertsService.
 * Wszystkie wywołania fire-and-forget — nie blokują request path.
 *
 * backend/src/modules/integrations/integration-event.service.ts
 *
 * UŻYCIE w istniejących serwisach:
 *
 *   // reservations.service.ts
 *   constructor(
 *     private integrationEvents: IntegrationEventService,
 *     // ...reszta
 *   ) {}
 *
 *   async create(actorId, dto, actorOrgId) {
 *     const reservation = await this.prisma.reservation.create(...);
 *     // Dispatch bez await — nie blokuje
 *     this.integrationEvents.onReservationCreated(actorOrgId, reservation).catch(() => {});
 *     return reservation;
 *   }
 */
import { Injectable, Logger } from '@nestjs/common';
import { SlackProvider }      from './providers/slack.provider';
import { TeamsProvider }      from './providers/teams.provider';
import { WebhookProvider }    from './providers/webhook.provider';

@Injectable()
export class IntegrationEventService {
  private readonly logger = new Logger(IntegrationEventService.name);

  constructor(
    private readonly slack:   SlackProvider,
    private readonly teams:   TeamsProvider,
    private readonly webhook: WebhookProvider,
  ) {}

  // ── Rezerwacja stworzona ────────────────────────────────────
  async onReservationCreated(orgId: string, data: {
    id:          string;
    deskName?:   string;
    userName?:   string;
    locationName?: string;
    date?:       string;
    startTime?:  string;
    endTime?:    string;
  }): Promise<void> {
    const title = `Nowa rezerwacja — ${data.deskName ?? 'biurko'}`;
    const body  = data.date
      ? `${data.userName ?? 'Użytkownik'} zarezerwował biurko na ${data.date}${data.startTime ? ` (${data.startTime}–${data.endTime})` : ''}`
      : `${data.userName ?? 'Użytkownik'} zarezerwował biurko`;

    await Promise.allSettled([
      this.slack.send(orgId,   { event: 'reservation', title, body, ...data }),
      this.teams.send(orgId,   { event: 'reservation', title, body, ...data }),
      this.webhook.dispatch(orgId, {
        event: 'reservation.created',
        organizationId: orgId,
        data: { reservationId: data.id, ...data },
        timestamp: new Date().toISOString(),
      }),
    ]);
  }

  // ── Rezerwacja anulowana ────────────────────────────────────
  async onReservationCancelled(orgId: string, data: {
    id: string; deskName?: string; userName?: string;
  }): Promise<void> {
    await Promise.allSettled([
      this.webhook.dispatch(orgId, {
        event: 'reservation.cancelled',
        organizationId: orgId,
        data: { reservationId: data.id, ...data },
        timestamp: new Date().toISOString(),
      }),
    ]);
  }

  // ── Check-in ────────────────────────────────────────────────
  async onCheckin(orgId: string, method: 'nfc' | 'qr' | 'manual', data: {
    deskId?:     string;
    deskName?:   string;
    userName?:   string;
    locationName?: string;
    userId?:     string;
  }): Promise<void> {
    const title = `Check-in — ${data.deskName ?? 'biurko'}`;
    const body  = `${data.userName ?? 'Użytkownik'} zameldował się (${method.toUpperCase()})`;
    const event = method === 'nfc' ? 'checkin.nfc' : method === 'qr' ? 'checkin.qr' : 'checkin.manual';

    await Promise.allSettled([
      this.slack.send(orgId,   { event: 'checkin', title, body, ...data }),
      this.teams.send(orgId,   { event: 'checkin', title, body, ...data }),
      this.webhook.dispatch(orgId, {
        event: event as any,
        organizationId: orgId,
        deskId: data.deskId,
        userId: data.userId,
        data: { method, ...data },
        timestamp: new Date().toISOString(),
      }),
    ]);
  }

  // ── Beacon offline ──────────────────────────────────────────
  async onBeaconOffline(orgId: string, data: {
    deviceId:    string;
    deskName?:   string;
    locationName?: string;
    lastSeenAgo?: number; // sekundy
  }): Promise<void> {
    const title = `⚠️ Beacon offline — ${data.deskName ?? data.deviceId}`;
    const body  = data.lastSeenAgo
      ? `Beacon nie odpowiada od ${Math.round(data.lastSeenAgo / 60)} min`
      : 'Beacon przestał odpowiadać';

    await Promise.allSettled([
      this.slack.send(orgId, {
        event: 'beacon_alert', title, body,
        deskName: data.deskName, locationName: data.locationName, urgent: true,
      }),
      this.teams.send(orgId, {
        event: 'beacon_alert', title, body,
        deskName: data.deskName, locationName: data.locationName, urgent: true,
      }),
      this.webhook.dispatch(orgId, {
        event: 'beacon.offline',
        organizationId: orgId,
        data: { deviceId: data.deviceId, ...data },
        timestamp: new Date().toISOString(),
      }),
    ]);
  }

  // ── Gateway offline ─────────────────────────────────────────
  async onGatewayOffline(orgId: string, data: {
    gatewayId:   string;
    locationName?: string;
  }): Promise<void> {
    const title = `🔴 Gateway offline`;
    const body  = `Gateway ${data.gatewayId}${data.locationName ? ` (${data.locationName})` : ''} stracił połączenie`;

    await Promise.allSettled([
      this.slack.send(orgId, { event: 'gateway_alert', title, body, locationName: data.locationName, urgent: true }),
      this.teams.send(orgId, { event: 'gateway_alert', title, body, locationName: data.locationName, urgent: true }),
      this.webhook.dispatch(orgId, {
        event: 'gateway.offline',
        organizationId: orgId,
        data: { gatewayId: data.gatewayId, ...data },
        timestamp: new Date().toISOString(),
      }),
    ]);
  }
}
