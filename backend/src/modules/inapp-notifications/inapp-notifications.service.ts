/**
 * InAppNotificationsService — powiadomienia w aplikacji (dzwonek w panelu).
 *
 * Zarządza powiadomieniami wyświetlanymi w interfejsie użytkownika dla ról
 * STAFF i wyższych. Każde powiadomienie ma typ (InAppNotifType), wiadomość,
 * opcjonalny link i status przeczytania per użytkownik.
 *
 * Mechanizm deduplikacji: klucz dedupe (np. `gateway_offline:${gatewayId}`)
 * zapobiega tworzeniu wielu identycznych powiadomień w krótkim czasie.
 *
 * CRON co 6h: wysyłka emailowych alertów o nieprzeczytanych powiadomieniach
 * (alerty krytyczne: GATEWAY_OFFLINE, BEACON_OFFLINE).
 *
 * backend/src/modules/inapp-notifications/inapp-notifications.service.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron }                from '@nestjs/schedule';
import { PrismaService }       from '../../database/prisma.service';
import { IntegrationEventService } from '../integrations/integration-event.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService }          from '../push/push.service';

export enum InAppNotifType {
  GATEWAY_OFFLINE          = 'GATEWAY_OFFLINE',
  GATEWAY_BACK_ONLINE      = 'GATEWAY_BACK_ONLINE',
  BEACON_OFFLINE           = 'BEACON_OFFLINE',
  FIRMWARE_UPDATE          = 'FIRMWARE_UPDATE',
  GATEWAY_RESET_NEEDED     = 'GATEWAY_RESET_NEEDED',
  RESERVATION_CHECKIN_MISSED = 'RESERVATION_CHECKIN_MISSED',
  SYSTEM_ANNOUNCEMENT      = 'SYSTEM_ANNOUNCEMENT',
  GATEWAY_KEY_ROTATION_FAILED = 'GATEWAY_KEY_ROTATION_FAILED',
  SUBSCRIPTION_EXPIRING    = 'SUBSCRIPTION_EXPIRING',
  SUBSCRIPTION_EXPIRED     = 'SUBSCRIPTION_EXPIRED',
  TRIAL_EXPIRING           = 'TRIAL_EXPIRING',
  LIMIT_WARNING            = 'LIMIT_WARNING',
}

interface CreateInAppDto {
  type:            InAppNotifType;
  title:           string;
  body:            string;
  organizationId?: string;
  userId?:         string;
  targetRoles?:    string[];
  actionUrl?:      string;
  actionLabel?:    string;
  meta?:           Record<string, any>;
}

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);

  constructor(
    private readonly prisma:            PrismaService,
    private readonly integrationEvents: IntegrationEventService,
    private readonly notifications:     NotificationsService,
    private readonly pushService:       PushService,
  ) {}

  // ── Utwórz powiadomienie (z deduplication) ────────────────────
  async create(dto: CreateInAppDto, dedupeKey?: string, dedupeMinutes = 60): Promise<void> {
    if (dedupeKey) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);
      const exists = await this.prisma.inAppNotification.findFirst({
        where: { dedupeKey, createdAt: { gte: since } },
        select: { id: true },
      });
      if (exists) return; // deduplicate
    }

    // Jeśli targetRoles określone — wyślij do wszystkich userów w org z tą rolą
    if (dto.targetRoles && dto.organizationId) {
      const users = await this.prisma.user.findMany({
        where: {
          organizationId: dto.organizationId,
          role:           { in: dto.targetRoles as any },
          isActive:       true,
        },
        select: { id: true },
      });
      for (const u of users) {
        await this.prisma.inAppNotification.create({
          data: {
            userId:    u.id,
            type:      dto.type,
            title:     dto.title,
            body:      dto.body,
            actionUrl:  dto.actionUrl,
            actionLabel: dto.actionLabel,
            meta:      dto.meta ? JSON.stringify(dto.meta) : null,
            dedupeKey: dedupeKey ?? null,
          },
        }).catch(() => {});
      }
    }

    // Jeśli konkretny userId
    if (dto.userId) {
      await this.prisma.inAppNotification.create({
        data: {
          userId:      dto.userId,
          type:        dto.type,
          title:       dto.title,
          body:        dto.body,
          actionUrl:   dto.actionUrl,
          actionLabel: dto.actionLabel,
          meta:        dto.meta ? JSON.stringify(dto.meta) : null,
          dedupeKey:   dedupeKey ?? null,
        },
      }).catch(() => {});
    }
  }

  // ── Pobierz powiadomienia dla usera ──────────────────────────
  async getForUser(userId: string, options: { unreadOnly?: boolean; limit?: number }) {
    const where: any = { userId };
    if (options.unreadOnly) where.read = false;

    return this.prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    options.limit ?? 30,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, ids: string[]) {
    await this.prisma.inAppNotification.updateMany({
      where: { id: { in: ids }, userId },
      data:  { read: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.inAppNotification.updateMany({
      where: { userId, read: false },
      data:  { read: true, readAt: new Date() },
    });
  }

  async deleteOne(userId: string, id: string) {
    await this.prisma.inAppNotification.deleteMany({ where: { id, userId } });
  }

  // ── Reguły konfiguracji ───────────────────────────────────────
  async getRules() {
    return this.prisma.notificationRule.findMany({ orderBy: { type: 'asc' } });
  }

  async upsertRule(type: InAppNotifType, enabled: boolean, targetRoles: string[]) {
    return this.prisma.notificationRule.upsert({
      where:  { type },
      update: { enabled, targetRoles, updatedAt: new Date() },
      create: { type, enabled, targetRoles },
    });
  }

  async announce(title: string, body: string, targetRoles: string[]): Promise<{ count: number }> {
    const users = await this.prisma.user.findMany({
      where:  { role: { in: targetRoles as any }, isActive: true },
      select: { id: true },
    });

    for (const u of users) {
      await this.prisma.inAppNotification.create({
        data: {
          userId:    u.id,
          type:      InAppNotifType.SYSTEM_ANNOUNCEMENT,
          title,
          body,
          dedupeKey: null,
        },
      }).catch(() => {});
    }

    // Web push — błędy (brak subskrypcji, brak VAPID) nie przerywają flow
    await Promise.allSettled(
      users.map(u =>
        this.pushService.notifyUser(u.id, { title, body, url: '/notifications' }),
      ),
    );

    return { count: users.length };
  }

  async notifyOrgPush(
    orgId:   string,
    roles:   string[],
    payload: { title: string; body: string; url?: string },
  ): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: orgId,
        role:           { in: roles as any },
        isActive:       true,
      },
      select: { id: true },
    });

    await Promise.allSettled(
      users.map(u => this.pushService.notifyUser(u.id, payload)),
    );
  }

  // ── Cron: co 5 min — skanuj offline gateway/beacon ───────────
  @Cron('0 */5 * * * *')
  async scanInfrastructure() {
    const now     = new Date();
    const cutoff5 = new Date(now.getTime() - 5 * 60 * 1000);

    // ── Gatewaye offline ─────────────────────────────────────────
    const offlineGws = await this.prisma.gateway.findMany({
      where:   { isOnline: true, lastSeen: { lt: cutoff5 } },
      include: { location: { include: { organization: true } } },
    });

    for (const gw of offlineGws) {
      const orgId = gw.location?.organization?.id;

      // In-app notification
      await this.create({
        type:           InAppNotifType.GATEWAY_OFFLINE,
        title:          `Gateway offline — ${gw.name}`,
        body:           `Gateway "${gw.name}" (${gw.location?.name}) nie wysyła heartbeatu od ponad 10 minut. Sprawdź połączenie Raspberry Pi.`,
        organizationId: orgId,
        targetRoles:    ['SUPER_ADMIN', 'OFFICE_ADMIN'],
        actionUrl:      '/provisioning',
        actionLabel:    'Sprawdź',
        meta:           { gatewayId: gw.id, locationName: gw.location?.name },
      }, `inapp:gw:${gw.id}:offline`, 120);

      // Email alert (with its own dedup via notificationLog)
      this.notifications.alertGatewayOffline(gw.id).catch(() => {});

      // Sprint F — dispatch do Slack/Teams/Webhook
      if (orgId) {
        this.integrationEvents.onGatewayOffline(orgId, {
          gatewayId:    gw.id,
          locationName: gw.location?.name ?? undefined,
        }).catch(() => {});
      }

      // Zaktualizuj isOnline = false w DB (po wysłaniu alertów)
      await this.prisma.gateway.update({
        where: { id: gw.id },
        data:  { isOnline: false },
      }).catch(() => {});
    }

    // ── Beacony offline ──────────────────────────────────────────
    const offlineDevices = await this.prisma.device.findMany({
      where:   { isOnline: true, lastSeen: { lt: cutoff5 } },
      include: { desk: { include: { location: { include: { organization: true } } } } },
    });

    for (const dev of offlineDevices) {
      const orgId = dev.desk?.location?.organization?.id;

      // In-app notification
      await this.create({
        type:           InAppNotifType.BEACON_OFFLINE,
        title:          `Beacon offline — ${dev.desk?.name ?? dev.hardwareId}`,
        body:           `Beacon przy biurku "${dev.desk?.name}" nie wysyła heartbeatu. Sprawdź zasilanie urządzenia.`,
        organizationId: orgId,
        targetRoles:    ['SUPER_ADMIN', 'OFFICE_ADMIN'],
        actionUrl:      '/provisioning',
        actionLabel:    'Urządzenia',
        meta:           { deviceId: dev.id, hardwareId: dev.hardwareId, deskName: dev.desk?.name },
      }, `inapp:beacon:${dev.id}:offline`, 120);

      // Email alert (with its own dedup via notificationLog)
      this.notifications.alertBeaconOffline(dev.id).catch(() => {});

      // Sprint F — dispatch do Slack/Teams/Webhook
      if (orgId) {
        const lastSeenAgo = dev.lastSeen
          ? Math.round((Date.now() - new Date(dev.lastSeen).getTime()) / 1000)
          : undefined;

        this.integrationEvents.onBeaconOffline(orgId, {
          deviceId:     dev.hardwareId,
          deskName:     dev.desk?.name ?? undefined,
          locationName: dev.desk?.location?.name ?? undefined,
          lastSeenAgo,
        }).catch(() => {});
      }

      // Zaktualizuj isOnline = false w DB (po wysłaniu alertów)
      await this.prisma.device.update({
        where: { id: dev.id },
        data:  { isOnline: false },
      }).catch(() => {});
    }
  }

  // ── Cron: co 6h — sprawdź nowe wersje firmware ───────────────
  @Cron('0 0 */6 * * *')
  async checkFirmwareUpdate() {
    try {
      const resp = await fetch('https://api.github.com/repos/lewski22/desk-firmware/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!resp.ok) return;
      const data = await resp.json() as any;
      const version = data.tag_name?.replace(/^v/, '') ?? '';
      if (!version) return;

      const outdated = await this.prisma.device.findFirst({
        where: { firmwareVersion: { not: version } },
      });
      if (!outdated) return;

      await this.create({
        type:        InAppNotifType.FIRMWARE_UPDATE,
        title:       `Nowa wersja firmware — v${version}`,
        body:        `Dostępna jest aktualizacja firmware beaconów do wersji v${version}.`,
        actionUrl:   '/provisioning',
        actionLabel: 'Aktualizuj',
        meta:        { version, url: data.assets?.[0]?.browser_download_url },
      }, `inapp:firmware:${version}`, 24 * 60);
    } catch { /* offline / rate limit */ }
  }

  // ── Cron: co dobę — usuń stare przeczytane powiadomienia ─────
  @Cron('0 0 3 * * *')
  async cleanup() {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const result = await this.prisma.inAppNotification.deleteMany({
      where: { read: true, createdAt: { lt: cutoff } },
    });
    if (result.count > 0) this.logger.log(`Cleanup: deleted ${result.count} old notifications`);
  }
}
