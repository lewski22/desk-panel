/**
 * NotificationsService — powiadomienia email i webpush dla adminów i użytkowników.
 *
 * Centralny punkt wysyłki powiadomień domenowych:
 * - Alert: gateway offline / back online (email do OFFICE_ADMIN)
 * - Alert: beacon offline / aktualizacja firmware
 * - Powiadomienia subskrypcyjne: wygasający / wygasły plan
 * - Emaile transakcyjne: check-in, checkout, rezerwacja
 * - Konfiguracja reguł powiadamiania per org (NotificationRule)
 * - CRUD ustawień powiadomień per użytkownik
 *
 * Wybór SMTP: preferuje własny serwer org (MailerService), fallback do globalnego.
 *
 * backend/src/modules/notifications/notifications.service.ts
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService }  from '../../database/prisma.service';
import { MailerService }  from './mailer.service';

const APP_URL = (config: ConfigService) =>
  config.get<string>('APP_URL', 'https://app.prohalw2026.ovh');

function escapeHtml(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma:  PrismaService,
    private _mailer: MailerService,
    private config:  ConfigService,
  ) {}

  // Publiczny dostęp do MailerService (dla kontrolera — SMTP config)
  get mailer(): MailerService { return this._mailer; }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — wywoływane z innych serwisów
  // ══════════════════════════════════════════════════════════════

  /** Gateway stracił połączenie */
  async alertGatewayOffline(gatewayId: string) {
    const gw = await this.prisma.gateway.findUnique({
      where:   { id: gatewayId },
      include: { location: { include: { organization: true } } },
    });
    if (!gw) return;

    const org    = gw.location?.organization;
    if (!org) return;
    const dedupeKey = `gateway:${gatewayId}:offline`;

    // Dedup — nie wysyłaj częściej niż raz na 1h
    if (await this._isDuplicate(dedupeKey, 60)) return;

    await this._sendOrgAlert(org.id, NotificationType.GATEWAY_OFFLINE, {
      dedupeKey,
      subject:  `⚠️ Gateway offline — ${gw.location?.name ?? gw.name}`,
      title:    'Gateway stracił połączenie',
      body: `
        <p>Gateway <strong>${gw.name}</strong> w lokalizacji <strong>${gw.location?.name}</strong>
        nie wysyła heartbeatu.</p>
        <p style="color:#ef4444">Beacony w tej lokalizacji mogą nie działać poprawnie
        dopóki połączenie nie zostanie przywrócone.</p>
        <p><strong>Ostatnia aktywność:</strong> ${gw.lastSeen
          ? new Date(gw.lastSeen).toLocaleString('pl-PL')
          : 'nieznana'}</p>
        <p>Sprawdź stan Raspberry Pi i połączenie sieciowe.</p>
      `,
      ctaLabel: 'Sprawdź panel',
      ctaUrl:   `${APP_URL(this.config)}/provisioning`,
      color:    '#ef4444',
    });
  }

  /** Beacon stracił połączenie */
  async alertBeaconOffline(deviceId: string) {
    const dev = await this.prisma.device.findUnique({
      where:   { id: deviceId },
      include: { desk: { include: { location: { include: { organization: true } } } } },
    });
    if (!dev) return;

    const org       = dev.desk?.location?.organization;
    if (!org) return;
    const dedupeKey = `beacon:${deviceId}:offline`;

    if (await this._isDuplicate(dedupeKey, 60)) return;

    await this._sendOrgAlert(org.id, NotificationType.BEACON_OFFLINE, {
      dedupeKey,
      subject:  `⚠️ Beacon offline — ${dev.desk?.name ?? dev.hardwareId}`,
      title:    'Beacon stracił połączenie',
      body: `
        <p>Beacon przy biurku <strong>${dev.desk?.name ?? '–'}</strong>
        (hardware ID: <code>${dev.hardwareId}</code>) nie wysyła heartbeatu.</p>
        <p>Biurko może nie reagować na karty NFC.</p>
        <p><strong>Ostatnia aktywność:</strong> ${dev.lastSeen
          ? new Date(dev.lastSeen).toLocaleString('pl-PL')
          : 'nieznana'}</p>
      `,
      ctaLabel: 'Sprawdź urządzenia',
      ctaUrl:   `${APP_URL(this.config)}/provisioning`,
      color:    '#f59e0b',
    });
  }

  /** Nowa wersja firmware dostępna */
  async alertFirmwareUpdate(version: string, url: string) {
    const dedupeKey = `firmware:${version}:available`;
    if (await this._isDuplicate(dedupeKey, 24 * 60)) return;

    // Wyślij do wszystkich aktywnych organizacji z włączonym typem
    const settings = await this.prisma.notificationSetting.findMany({
      where: {
        type:    NotificationType.FIRMWARE_UPDATE_AVAILABLE,
        enabled: true,
        organization: { isActive: true },
      },
      include: { organization: true },
    });

    for (const s of settings) {
      const recipients = await this._resolveRecipients(s);
      if (!recipients.length) continue;

      await this._send({
        type:          NotificationType.FIRMWARE_UPDATE_AVAILABLE,
        organizationId: s.organizationId,
        dedupeKey,
        recipients,
        subject:       `🆕 Nowa wersja firmware Reserti — v${version}`,
        title:         'Dostępna aktualizacja firmware',
        body: `
          <p>Dostępna jest nowa wersja firmware dla beaconów Reserti.</p>
          <ul>
            <li><strong>Wersja:</strong> v${version}</li>
            <li><strong>Pobierz:</strong> <a href="${url}">${url}</a></li>
          </ul>
          <p>Zaktualizuj beacony przez panel Provisioning → przycisk OTA Update.</p>
        `,
        ctaLabel: 'Otwórz panel Provisioning',
        ctaUrl:   `${APP_URL(this.config)}/provisioning`,
        color:    '#6366f1',
      });
    }
  }

  /** Potwierdzenie rezerwacji — wysyłane do pracownika */
  async notifyReservationConfirmed(reservationId: string) {
    const res = await this.prisma.reservation.findUnique({
      where:   { id: reservationId },
      include: {
        user: true,
        desk: { include: { location: { include: { organization: true } } } },
      },
    });
    if (!res || !res.user.email) return;

    const org = res.desk.location?.organization;
    if (!org) return;

    const enabled = await this._isEnabled(org.id, NotificationType.RESERVATION_CONFIRMED);
    if (!enabled) return;

    const tz    = res.desk.location?.timezone ?? 'Europe/Warsaw';
    const start = new Date(res.startTime).toLocaleString('pl-PL', { timeZone: tz });
    const end   = new Date(res.endTime).toLocaleString('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

    await this._send({
      type:           NotificationType.RESERVATION_CONFIRMED,
      organizationId: org.id,
      recipients:     [res.user.email],
      subject:        `✅ Rezerwacja potwierdzona — ${res.desk.name}`,
      title:          'Twoja rezerwacja jest potwierdzona',
      body: `
        <p>Cześć ${res.user.firstName ?? ''}!</p>
        <p>Twoja rezerwacja biurka została potwierdzona:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#6b7280;width:40%">Biurko:</td>
              <td style="padding:6px 0;font-weight:600">${res.desk.name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Lokalizacja:</td>
              <td style="padding:6px 0">${res.desk.location?.name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Data i godzina:</td>
              <td style="padding:6px 0;font-weight:600">${start} – ${end}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px">
          Check-in: zeskanuj kod QR na biurku lub użyj karty NFC.
        </p>
      `,
      ctaLabel: 'Moje rezerwacje',
      ctaUrl:   `${APP_URL(this.config)}/my-reservations`,
    });
  }

  /** Anulowanie rezerwacji */
  async notifyReservationCancelled(reservationId: string, reason?: string) {
    const res = await this.prisma.reservation.findUnique({
      where:   { id: reservationId },
      include: {
        user: true,
        desk: { include: { location: { include: { organization: true } } } },
      },
    });
    if (!res || !res.user.email) return;

    const org = res.desk.location?.organization;
    if (!org) return;
    if (!await this._isEnabled(org.id, NotificationType.RESERVATION_CANCELLED)) return;

    const tz    = res.desk.location?.timezone ?? 'Europe/Warsaw';
    const start = new Date(res.startTime).toLocaleString('pl-PL', { timeZone: tz });

    await this._send({
      type:           NotificationType.RESERVATION_CANCELLED,
      organizationId: org.id,
      recipients:     [res.user.email],
      subject:        `❌ Rezerwacja anulowana — ${res.desk.name}`,
      title:          'Twoja rezerwacja została anulowana',
      body: `
        <p>Cześć ${res.user.firstName ?? ''}!</p>
        <p>Rezerwacja biurka <strong>${res.desk.name}</strong> na <strong>${start}</strong>
        została anulowana${reason ? ': ' + reason : ''}.</p>
        <p>Jeśli chcesz zarezerwować inne biurko, skorzystaj z mapy biurek.</p>
      `,
      ctaLabel: 'Mapa biurek',
      ctaUrl:   `${APP_URL(this.config)}/map`,
      color:    '#ef4444',
    });
  }

  /** Potwierdzenie rezerwacji sali / parkingu */
  async notifyBookingConfirmed(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        user:     true,
        resource: { include: { location: { include: { organization: true } } } },
      },
    });
    if (!booking || !booking.user.email || !booking.resource) return;
    const org = booking.resource.location?.organization;
    if (!org) return;
    if (!await this._isEnabled(org.id, NotificationType.RESERVATION_CONFIRMED)) return;

    const tz           = booking.resource.location?.timezone ?? 'Europe/Warsaw';
    const icon         = booking.resource.type === 'PARKING' ? '🅿️' : '🏛';
    const label        = booking.resource.type === 'PARKING' ? 'miejsce parkingowe' : 'salę';
    const start        = new Date(booking.startTime).toLocaleString('pl-PL', { timeZone: tz });
    const end          = new Date(booking.endTime).toLocaleTimeString('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const firstName    = escapeHtml(booking.user.firstName);
    const resourceName = escapeHtml(booking.resource.name);
    const locationName = escapeHtml(booking.resource.location?.name);

    await this._send({
      type:           NotificationType.RESERVATION_CONFIRMED,
      organizationId: org.id,
      recipients:     [booking.user.email],
      subject:        `✅ Rezerwacja potwierdzona — ${icon} ${resourceName}`,
      title:          'Twoja rezerwacja jest potwierdzona',
      body: `
        <p>Cześć ${firstName}!</p>
        <p>Zarezerwowałeś/aś ${label}:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#6b7280;width:40%">Zasób:</td>
              <td style="padding:6px 0;font-weight:600">${icon} ${resourceName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Lokalizacja:</td>
              <td style="padding:6px 0">${locationName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Termin:</td>
              <td style="padding:6px 0;font-weight:600">${start} – ${end}</td></tr>
        </table>
      `,
      ctaLabel: 'Moje rezerwacje',
      ctaUrl:   `${APP_URL(this.config)}/my-reservations`,
    });
  }

  /** Anulowanie rezerwacji sali / parkingu */
  async notifyBookingCancelled(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        user:     true,
        resource: { include: { location: { include: { organization: true } } } },
      },
    });
    if (!booking || !booking.user.email || !booking.resource) return;
    const org = booking.resource.location?.organization;
    if (!org) return;
    if (!await this._isEnabled(org.id, NotificationType.RESERVATION_CANCELLED)) return;

    const tz           = booking.resource.location?.timezone ?? 'Europe/Warsaw';
    const icon         = booking.resource.type === 'PARKING' ? '🅿️' : '🏛';
    const start        = new Date(booking.startTime).toLocaleString('pl-PL', { timeZone: tz });
    const firstName    = escapeHtml(booking.user.firstName);
    const resourceName = escapeHtml(booking.resource.name);

    await this._send({
      type:           NotificationType.RESERVATION_CANCELLED,
      organizationId: org.id,
      recipients:     [booking.user.email],
      subject:        `❌ Rezerwacja anulowana — ${icon} ${resourceName}`,
      title:          'Twoja rezerwacja została anulowana',
      body: `
        <p>Cześć ${firstName}!</p>
        <p>Rezerwacja <strong>${resourceName}</strong> na <strong>${start}</strong>
        została anulowana.</p>
      `,
      ctaLabel: 'Zarezerwuj ponownie',
      ctaUrl:   `${APP_URL(this.config)}/map`,
      color:    '#ef4444',
    });
  }

  /** Brak check-in — auto-release */
  async notifyCheckinMissed(reservationId: string) {
    const res = await this.prisma.reservation.findUnique({
      where:   { id: reservationId },
      include: {
        user: true,
        desk: { include: { location: { include: { organization: true } } } },
      },
    });
    if (!res || !res.user.email) return;
    const org = res.desk.location?.organization;
    if (!org) return;
    if (!await this._isEnabled(org.id, NotificationType.CHECKIN_MISSED)) return;

    await this._send({
      type:           NotificationType.CHECKIN_MISSED,
      organizationId: org.id,
      recipients:     [res.user.email],
      subject:        `⏰ Biurko zwolnione — brak check-in (${res.desk.name})`,
      title:          'Biurko zostało automatycznie zwolnione',
      body: `
        <p>Cześć ${res.user.firstName ?? ''}!</p>
        <p>Twoje biurko <strong>${res.desk.name}</strong> zostało automatycznie zwolnione,
        ponieważ nie wykonano check-in w wymaganym czasie.</p>
        <p style="color:#6b7280;font-size:13px">
          Następnym razem pamiętaj o check-in przez kartę NFC lub skan QR.
        </p>
      `,
      ctaLabel: 'Zarezerwuj ponownie',
      ctaUrl:   `${APP_URL(this.config)}/map`,
      color:    '#f59e0b',
    });
  }

  // ══════════════════════════════════════════════════════════════
  // CRON JOBS
  // ══════════════════════════════════════════════════════════════

  /** Codziennie o 07:00 — dzienny raport zajętości */
  @Cron('0 0 7 * * *')
  async sendDailyReports() {
    const settings = await this.prisma.notificationSetting.findMany({
      where: {
        type:    NotificationType.DAILY_REPORT,
        enabled: true,
        organization: { isActive: true },
      },
      include: { organization: { include: { locations: true } } },
    });

    const yesterday     = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStart        = new Date(yesterday); yStart.setHours(0, 0, 0, 0);
    const yEnd          = new Date(yesterday); yEnd.setHours(23, 59, 59, 999);

    for (const s of settings) {
      const recipients = await this._resolveRecipients(s);
      if (!recipients.length) continue;

      const orgId = s.organizationId;

      const [totalDesks, checkins, reservations] = await Promise.all([
        this.prisma.desk.count({ where: { location: { organizationId: orgId }, status: 'ACTIVE' } }),
        this.prisma.checkin.count({
          where: { checkedInAt: { gte: yStart, lte: yEnd }, desk: { location: { organizationId: orgId } } },
        }),
        this.prisma.reservation.count({
          where: { date: yStart, status: { in: ['CONFIRMED', 'COMPLETED', 'EXPIRED'] }, desk: { location: { organizationId: orgId } } },
        }),
      ]);

      const dateStr = yesterday.toLocaleDateString('pl-PL');

      await this._send({
        type:           NotificationType.DAILY_REPORT,
        organizationId: orgId,
        recipients,
        subject:        `📊 Raport zajętości — ${dateStr} — ${s.organization.name}`,
        title:          `Raport zajętości — ${dateStr}`,
        body: `
          <p>Podsumowanie dnia <strong>${dateStr}</strong> dla <strong>${s.organization.name}</strong>:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f9fafb">
              <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">Aktywne biurka</td>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;text-align:right">${totalDesks}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">Rezerwacje</td>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;text-align:right">${reservations}</td>
            </tr>
            <tr style="background:#f9fafb">
              <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">Check-iny</td>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;text-align:right">${checkins}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #e5e7eb;color:#6b7280">Współczynnik wykorzystania</td>
              <td style="padding:10px;border:1px solid #e5e7eb;font-weight:700;text-align:right;color:#B03472">
                ${totalDesks > 0 ? Math.round((reservations / totalDesks) * 100) : 0}%
              </td>
            </tr>
          </table>
        `,
        ctaLabel: 'Pełne raporty',
        ctaUrl:   `${APP_URL(this.config)}/reports`,
      });
    }
  }

  /** Co 30 min — przypomnienia o rezerwacjach na kolejne 30 min */
  @Cron('0 */30 * * * *')
  async sendReservationReminders() {
    const settings = await this.prisma.notificationSetting.findMany({
      where: { type: NotificationType.RESERVATION_REMINDER, enabled: true },
    });
    if (!settings.length) return;

    const orgIds = settings.map(s => s.organizationId);
    const now    = new Date();
    const in30   = new Date(now.getTime() + 30 * 60 * 1000);
    const in35   = new Date(now.getTime() + 35 * 60 * 1000);

    const upcoming = await this.prisma.reservation.findMany({
      where: {
        status:    'CONFIRMED',
        startTime: { gte: in30, lt: in35 },
        checkin:   null,  // nie zrobiono jeszcze check-in
        desk:      { location: { organizationId: { in: orgIds } } },
      },
      include: {
        user: true,
        desk: { include: { location: true } },
      },
    });

    for (const res of upcoming) {
      if (!res.user.email) continue;
      const dedupeKey = `reminder:${res.id}`;
      if (await this._isDuplicate(dedupeKey, 60)) continue;

      const start = new Date(res.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

      await this._send({
        type:           NotificationType.RESERVATION_REMINDER,
        organizationId: res.desk.location?.organizationId ?? '',
        dedupeKey,
        recipients:     [res.user.email],
        subject:        `⏰ Przypomnienie — rezerwacja o ${start} (${res.desk.name})`,
        title:          'Przypomnienie o rezerwacji',
        body: `
          <p>Cześć ${res.user.firstName ?? ''}!</p>
          <p>Za 30 minut zaczyna się Twoja rezerwacja:</p>
          <p style="font-size:18px;font-weight:700;color:#1a1a2e;margin:16px 0">
            ${res.desk.name} — godz. ${start}
          </p>
          <p style="color:#6b7280;font-size:13px">
            Pamiętaj o check-in przez kartę NFC lub skan kodu QR.
          </p>
        `,
        ctaLabel: 'Moje rezerwacje',
        ctaUrl:   `${APP_URL(this.config)}/my-reservations`,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CRUD SETTINGS (dla kontrolera)
  // ══════════════════════════════════════════════════════════════

  async getSettings(organizationId: string) {
    const saved = await this.prisma.notificationSetting.findMany({
      where: { organizationId },
      orderBy: { type: 'asc' },
    });
    return saved;
  }

  async upsertSetting(organizationId: string, type: string, data: {
    enabled:      boolean;
    recipients?:  string[];
    thresholdMin?: number;
  }) {
    return this.prisma.notificationSetting.upsert({
      where:  { organizationId_type: { organizationId, type: type as any } },
      update: {
        enabled:      data.enabled,
        recipients:   data.recipients ?? [],
        thresholdMin: data.thresholdMin,
        updatedAt:    new Date(),
      },
      create: {
        organizationId,
        type:         type as any,
        enabled:      data.enabled,
        recipients:   data.recipients ?? [],
        thresholdMin: data.thresholdMin,
      },
    });
  }

  async getLog(organizationId: string, limit = 50) {
    return this.prisma.notificationLog.findMany({
      where:   { organizationId },
      orderBy: { sentAt: 'desc' },
      take:    limit,
    });
  }

  async testSend(organizationId: string, email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email format');
    }
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    const result = await this._mailer.send({
      to:      email,
      subject: '✅ Test powiadomień — Reserti',
      html:    this._mailer.buildHtml({
        title: 'Test powiadomień',
        body:  `<p>Powiadomienia email dla organizacji <strong>${org?.name}</strong> działają poprawnie.</p>`,
      }),
    });
    return result;
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  private async _isEnabled(organizationId: string, type: NotificationType): Promise<boolean> {
    const s = await this.prisma.notificationSetting.findUnique({
      where: { organizationId_type: { organizationId, type } },
    });
    return s?.enabled ?? false;
  }

  private async _resolveRecipients(setting: {
    organizationId: string;
    recipients: string[];
  }): Promise<string[]> {
    if (setting.recipients.length > 0) return setting.recipients;

    // Fallback: SUPER_ADMINowie organizacji
    const admins = await this.prisma.user.findMany({
      where:  { organizationId: setting.organizationId, role: 'SUPER_ADMIN', isActive: true },
      select: { email: true },
    });
    return admins.map(u => u.email).filter(Boolean) as string[];
  }

  private async _isDuplicate(dedupeKey: string, withinMinutes: number): Promise<boolean> {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000);
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        dedupeKey,
        sentAt:  { gte: since },
        success: true,
      },
    });
    return !!existing;
  }

  private async _sendOrgAlert(
    organizationId: string,
    type:           NotificationType,
    opts: {
      dedupeKey?: string;
      subject:    string;
      title:      string;
      body:       string;
      ctaLabel?:  string;
      ctaUrl?:    string;
      color?:     string;
    },
  ) {
    const setting = await this.prisma.notificationSetting.findUnique({
      where: { organizationId_type: { organizationId, type } },
    });
    if (!setting?.enabled) return;

    const recipients = await this._resolveRecipients(setting);
    if (!recipients.length) return;

    await this._send({ type, organizationId, recipients, ...opts });
  }

  private async _send(opts: {
    type:            NotificationType;
    organizationId?: string;
    recipients:      string[];
    dedupeKey?:      string;
    subject:         string;
    title:           string;
    body:            string;
    ctaLabel?:       string;
    ctaUrl?:         string;
    color?:          string;
  }) {
    const html = this._mailer.buildHtml({
      title:    opts.title,
      body:     opts.body,
      ctaLabel: opts.ctaLabel,
      ctaUrl:   opts.ctaUrl,
      color:    opts.color,
    });

    const result = await this._mailer.send({
      to:      opts.recipients,
      subject: opts.subject,
      html,
    }, opts.organizationId);

    // Zawsze loguj (nawet gdy SMTP nie skonfigurowany)
    await this.prisma.notificationLog.create({
      data: {
        type:           opts.type,
        organizationId: opts.organizationId,
        subject:        opts.subject,
        recipients:     opts.recipients,
        dedupeKey:      opts.dedupeKey,
        success:        result.ok,
        errorMsg:       result.error,
      },
    }).catch(() => {});
  }
}
