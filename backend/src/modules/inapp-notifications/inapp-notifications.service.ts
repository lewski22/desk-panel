import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InAppNotifType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateNotifPayload {
  type:          InAppNotifType;
  title:         string;
  body:          string;
  organizationId?: string;
  meta?:         Record<string, any>;
  actionUrl?:    string;
  actionLabel?:  string;
}

@Injectable()
export class InAppNotificationsService {
  private readonly logger = new Logger(InAppNotificationsService.name);
  // Dedup cache — zapobiega spamowi w RAM (restarty czyszczą)
  private readonly dedupeCache = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  // ── Utwórz powiadomienie dla wszystkich użytkowników pasujących ról ──
  async create(payload: CreateNotifPayload, dedupeKey?: string, dedupeMinutes = 60) {
    // Sprawdź regułę — czy typ jest włączony i jakie role widzą
    const rule = await this.prisma.notificationRule.findUnique({
      where: { type: payload.type },
    });
    if (!rule?.enabled || !rule.targetRoles.length) return 0;

    // Deduplication — nie twórz ponownie jeśli było niedawno
    if (dedupeKey) {
      const lastTs = this.dedupeCache.get(dedupeKey);
      if (lastTs && Date.now() - lastTs < dedupeMinutes * 60 * 1000) return 0;
      this.dedupeCache.set(dedupeKey, Date.now());
    }

    // Znajdź użytkowników pasujących do reguły
    const users = await this.prisma.user.findMany({
      where: {
        role:     { in: rule.targetRoles as any[] },
        isActive: true,
        // Jeśli mamy organizationId — tylko użytkownicy tej org
        ...(payload.organizationId
          ? { organizationId: payload.organizationId }
          : {}),
        // Nie tworzy dla OWNER (nie ma org — Owner widzi globalnie przez własny panel)
      },
      select: { id: true },
    });

    if (!users.length) return 0;

    // Bulk insert
    const metaStr = payload.meta ? JSON.stringify(payload.meta) : null;
    await this.prisma.inAppNotification.createMany({
      data: users.map(u => ({
        userId:         u.id,
        organizationId: payload.organizationId ?? null,
        type:           payload.type,
        title:          payload.title,
        body:           payload.body,
        meta:           metaStr,
        actionUrl:      payload.actionUrl ?? null,
        actionLabel:    payload.actionLabel ?? null,
      })),
    });

    this.logger.log(
      `InApp [${payload.type}] → ${users.length} user(s)` +
      (payload.organizationId ? ` (org: ${payload.organizationId})` : ' (global)')
    );
    return users.length;
  }

  // ── Wyślij ogłoszenie Ownera do wszystkich firm ───────────────
  async createAnnouncement(title: string, body: string, targetRoles?: string[]) {
    // Jeśli targetRoles podane — nadpisz regułę dla tego jednego wysłania
    const rule = await this.prisma.notificationRule.findUnique({
      where: { type: InAppNotifType.SYSTEM_ANNOUNCEMENT },
    });
    const roles = targetRoles ?? rule?.targetRoles ?? ['SUPER_ADMIN'];

    const users = await this.prisma.user.findMany({
      where: { role: { in: roles as any[] }, isActive: true },
      select: { id: true, organizationId: true },
    });

    if (!users.length) return 0;

    await this.prisma.inAppNotification.createMany({
      data: users.map(u => ({
        userId:         u.id,
        organizationId: u.organizationId,
        type:           InAppNotifType.SYSTEM_ANNOUNCEMENT,
        title,
        body,
      })),
    });
    this.logger.log(`Announcement → ${users.length} user(s): "${title}"`);
    return users.length;
  }

  // ── Pobierz powiadomienia zalogowanego użytkownika ────────────
  async findForUser(userId: string, options: { unreadOnly?: boolean; limit?: number }) {
    const where: any = { userId };
    if (options.unreadOnly) where.read = false;

    return this.prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    options.limit ?? 30,
    });
  }

  // ── Liczba nieprzeczytanych ───────────────────────────────────
  async countUnread(userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: { userId, read: false },
    });
  }

  // ── Oznacz jako przeczytane ───────────────────────────────────
  async markRead(userId: string, ids: string[]) {
    const now = new Date();
    await this.prisma.inAppNotification.updateMany({
      where: { id: { in: ids }, userId },
      data:  { read: true, readAt: now },
    });
  }

  async markAllRead(userId: string) {
    const now = new Date();
    await this.prisma.inAppNotification.updateMany({
      where: { userId, read: false },
      data:  { read: true, readAt: now },
    });
  }

  async deleteOne(userId: string, id: string) {
    await this.prisma.inAppNotification.deleteMany({
      where: { id, userId },
    });
  }

  // ── Owner: reguły konfiguracji ────────────────────────────────
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

  // ── Cron: co 15 min skanuj offline gateway/beacon ────────────
  @Cron('0 */15 * * * *')
  async scanInfrastructure() {
    const now      = new Date();
    const cutoff10 = new Date(now.getTime() - 10 * 60 * 1000);

    // Gatewaye offline (isOnline=true ale lastSeen > 10 min)
    const offlineGws = await this.prisma.gateway.findMany({
      where: { isOnline: true, lastSeen: { lt: cutoff10 } },
      include: { location: { include: { organization: true } } },
    });

    for (const gw of offlineGws) {
      const orgId = gw.location?.organization?.id;
      await this.create({
        type:           InAppNotifType.GATEWAY_OFFLINE,
        title:          `Gateway offline — ${gw.name}`,
        body:           `Gateway "${gw.name}" (${gw.location?.name}) nie wysyła heartbeatu od ponad 10 minut. Sprawdź połączenie Raspberry Pi.`,
        organizationId: orgId,
        actionUrl:      '/provisioning',
        actionLabel:    'Sprawdź',
        meta:           { gatewayId: gw.id, locationName: gw.location?.name },
      }, `inapp:gw:${gw.id}:offline`, 120);
    }

    // Beacony offline
    const offlineDevices = await this.prisma.device.findMany({
      where: { isOnline: true, lastSeen: { lt: cutoff10 } },
      include: { desk: { include: { location: { include: { organization: true } } } } },
    });

    for (const dev of offlineDevices) {
      const orgId = dev.desk?.location?.organization?.id;
      await this.create({
        type:           InAppNotifType.BEACON_OFFLINE,
        title:          `Beacon offline — ${dev.desk?.name ?? dev.hardwareId}`,
        body:           `Beacon przy biurku "${dev.desk?.name}" nie wysyła heartbeatu. Sprawdź zasilanie urządzenia.`,
        organizationId: orgId,
        actionUrl:      '/provisioning',
        actionLabel:    'Urządzenia',
        meta:           { deviceId: dev.id, hardwareId: dev.hardwareId, deskName: dev.desk?.name },
      }, `inapp:beacon:${dev.id}:offline`, 120);
    }
  }

  // ── Cron: co godzinę sprawdzaj dostępność firmware ───────────
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

      // Porównaj z tym co mają urządzenia — jeśli ktokolwiek ma starszą wersję
      const outdated = await this.prisma.device.findFirst({
        where: { firmwareVersion: { not: version } },
      });
      if (!outdated) return;

      await this.create({
        type:        InAppNotifType.FIRMWARE_UPDATE,
        title:       `Nowa wersja firmware — v${version}`,
        body:        `Dostępna jest aktualizacja firmware beaconów do wersji v${version}. Zaktualizuj urządzenia przez panel Provisioning.`,
        actionUrl:   '/provisioning',
        actionLabel: 'Aktualizuj',
        meta:        { version, url: data.assets?.[0]?.browser_download_url },
      }, `inapp:firmware:${version}`, 24 * 60);
    } catch { /* offline / rate limit */ }
  }

  // ── Stare powiadomienia — usuwaj po 30 dniach ────────────────
  @Cron('0 0 3 * * *')
  async cleanup() {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const result = await this.prisma.inAppNotification.deleteMany({
      where: { read: true, createdAt: { lt: cutoff } },
    });
    if (result.count > 0)
      this.logger.log(`Cleanup: deleted ${result.count} old notifications`);
  }
}
