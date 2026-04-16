import { Injectable, Logger, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { InAppNotificationsService } from '../inapp-notifications/inapp-notifications.service';
import { EventType } from '@prisma/client';

@Injectable()
export class GatewaysService {
  private readonly logger = new Logger(GatewaysService.name);
  constructor(
    private prisma:  PrismaService,
    private config:  ConfigService,
    private inapp:   InAppNotificationsService,
  ) {}

  async register(locationId: string, name: string) {
    // FIX: crypto.randomBytes instead of Math.random()
    const secret     = randomBytes(24).toString('hex');
    const secretHash = await bcrypt.hash(secret, 10);

    const gateway = await this.prisma.gateway.create({
      data: { locationId, name, secretHash },
    });

    await this.prisma.event.create({
      data: {
        type: EventType.GATEWAY_ONLINE,
        entityType: 'gateway',
        entityId: gateway.id,
        gatewayId: gateway.id,
      },
    });

    return { gateway, secret };
  }

  async authenticate(gatewayId: string, secret: string) {
    const gw = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gw) throw new NotFoundException('Gateway not found');

    // Sprawdź główny sekret
    const validMain = await bcrypt.compare(secret, gw.secretHash);

    if (!validMain) {
      // Podczas okna rotacji (15 min) akceptuj też poprzedni sekret
      const inWindow = gw.secretHashPending && gw.secretPendingExpiresAt
        && new Date() < gw.secretPendingExpiresAt;

      const validPrev = inWindow
        ? await bcrypt.compare(secret, gw.secretHashPending!)
        : false;

      if (!validPrev) throw new UnauthorizedException('Invalid gateway secret');

      this.logger.warn(
        `Gateway ${gatewayId} authenticated with OLD secret — rotation in progress. ` +
        `Window expires: ${gw.secretPendingExpiresAt!.toISOString()}`
      );
    }

    await this.prisma.gateway.update({
      where: { id: gatewayId },
      data:  { isOnline: true, lastSeen: new Date() },
    });
    return gw;
  }

  async findAll(locationId?: string, actorOrgId?: string) {
    // Izolacja org — Gateway → Location → Organization
    const where: any = {};
    if (actorOrgId) {
      where.location = { organizationId: actorOrgId };
    }
    if (locationId) {
      // locationId doprecyzowuje, ale org guard nadal obowiązuje
      where.locationId = locationId;
    }
    return this.prisma.gateway.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        _count:   { select: { devices: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }

  async getSync(gatewayId: string) {
    const gw = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: { location: true },
    });
    if (!gw) throw new NotFoundException('Gateway not found');

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { locationId: gw.locationId },
        status: { in: ['CONFIRMED', 'PENDING'] },
        date:   { gte: today, lt: dayAfter },
      },
      include: {
        user: { select: { id: true, cardUid: true } },
        desk: { select: { id: true, code: true } },
      },
    });

    // Aktywne check-iny w tej lokalizacji (bez checkout) — używane przez gateway
    // do reconcylacji LED po restarcie beacona lub gateway
    const activeCheckins = await this.prisma.checkin.findMany({
      where: {
        checkedOutAt: null,
        desk: { locationId: gw.locationId },
      },
      select: {
        deskId:      true,
        userId:      true,
        checkedInAt: true,
      },
    });

    return { gatewayId, syncedAt: new Date(), reservations, activeCheckins };
  }

  async heartbeat(gatewayId: string, ipAddress?: string, version?: string) {
    return this.prisma.gateway.update({
      where: { id: gatewayId },
      data:  {
        isOnline: true,
        lastSeen: new Date(),
        ...(ipAddress && { ipAddress }),
        ...(version   && { version }),
      },
    });
  }

  async deviceHeartbeat(hardwareId: string, rssi?: number, firmwareVersion?: string, isOnline?: boolean) {
    const online = isOnline === false ? false : true;

    const device = await this.prisma.device.update({
      where: { hardwareId },
      data: {
        isOnline:  online,
        lastSeen:  new Date(),
        ...(rssi !== undefined && { rssi }),
        ...(firmwareVersion    && { firmwareVersion }),
      },
    });

    // OTA korelacja: beacon zameldował nową wersję = aktualizacja się powiodła
    if (
      firmwareVersion &&
      device.otaStatus === 'in_progress' &&
      device.otaVersion === firmwareVersion
    ) {
      await this.prisma.device.update({
        where: { id: device.id },
        data:  { otaStatus: 'success', otaFinishedAt: new Date() },
      });
      this.logger.log(`OTA success confirmed by heartbeat: ${hardwareId} v${firmwareVersion}`);
    }

    return device;
  }


  // ── Org guard dla gateways ─────────────────────────────────
  // Weryfikuje: Gateway → Location → Organization
  private async assertGatewayInOrg(gatewayId: string, actorOrgId?: string): Promise<void> {
    if (!actorOrgId) return;  // OWNER — brak ograniczenia
    const gw = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: { location: { select: { organizationId: true } } },
    });
    if (!gw) throw new NotFoundException(`Gateway ${gatewayId} not found`);
    if (gw.location?.organizationId !== actorOrgId) {
      throw new ForbiddenException('Gateway nie należy do Twojej organizacji');
    }
  }

  async remove(id: string, actorOrgId?: string) {
    await this.assertGatewayInOrg(id, actorOrgId);
    await this.prisma.gateway.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Rotacja sekretu z 15-minutowym oknem nakładki.
   *
   * Flow:
   *  1. Generuje nowy secret
   *  2. Zapisuje jako secretHashPending + expiresAt = now + 15min
   *  3. Wywołuje gateway HTTP POST /rotate-secret { newSecret } (ze starym secretem)
   *  4. Gateway zapisuje do .env i restartuje service
   *  5. Przy pierwszym heartbeat/sync z nowym secretem → promote (patrz authenticate)
   *
   * Okno 15 minut = failsafe gdy gateway nie mógł się zrestartować.
   * Po 15 minutach stary secret przestaje działać automatycznie.
   */
  async rotateSecret(id: string, actorOrgId?: string): Promise<{
    secret: string;
    secretPreview: string;
    expiresAt: Date;
    gatewayReached: boolean;
  }> {
    const gw = await this.prisma.gateway.findUnique({
      where:   { id },
      select:  { id: true, name: true, ipAddress: true, secretHash: true, location: { select: { organizationId: true } } },
    });
    if (!gw) throw new NotFoundException('Gateway not found');

    // ── Krok 1: Spróbuj dostarczyć nowy klucz do gateway ZANIM zmienisz backend ──
    // Jeśli gateway niedostępny → nie zmieniamy secretHash → brak desync.
    const newSecret     = randomBytes(24).toString('hex');
    const newSecretHash = await bcrypt.hash(newSecret, 10);
    const expiresAt     = new Date(Date.now() + 15 * 60 * 1000);

    let gatewayReached = false;

    if (!gw.ipAddress) {
      this.logger.warn(`Gateway ${id}: brak IP — rotacja niemożliwa bez kontaktu z gateway`);
      // Nie zmieniamy klucza — stary działa
      throw new Error(
        'Rotacja niemożliwa: brak adresu IP gateway. Gateway musi wysłać heartbeat żeby zarejestrować IP.'
      );
    }

    // Próba dostarczenia nowego klucza do gateway
    gatewayReached = await this._pushRotateSecret(gw.ipAddress, newSecret);

    if (!gatewayReached) {
      // Gateway niedostępny — NIE zmieniamy secretHash w backendzie
      // Stary klucz pozostaje ważny — brak desync
      this.logger.warn(
        `Gateway ${gw.name}: rotate-secret ABORTED — gateway niedostępny pod ${gw.ipAddress}:3001. ` +
        `Stary klucz pozostaje niezmieniony.`
      );
      // Wyślij powiadomienie in-app do SUPER_ADMIN w org — w obu językach (meta.translations)
      await this.inapp.create({
        type:           'GATEWAY_KEY_ROTATION_FAILED' as any,
        title:          `Gateway "${gw.name}" — rotacja klucza nieudana`,
        body:           `Nie można połączyć się z gateway "${gw.name}" (${gw.ipAddress}:3001). Klucz nie został zmieniony — stary klucz pozostaje ważny.`,
        organizationId: gw.location?.organizationId,
        actionUrl:      '/provisioning',
        actionLabel:    'Sprawdź gateway',
        meta: {
          gatewayId:   gw.id,
          gatewayName: gw.name,
          ipAddress:   gw.ipAddress,
          translations: {
            pl: {
              title:       `Gateway "${gw.name}" — rotacja klucza nieudana`,
              body:        `Nie można połączyć się z gateway "${gw.name}" (${gw.ipAddress}:3001). Klucz nie został zmieniony — stary klucz pozostaje ważny.`,
              actionLabel: 'Sprawdź gateway',
            },
            en: {
              title:       `Gateway "${gw.name}" — key rotation failed`,
              body:        `Cannot connect to gateway "${gw.name}" (${gw.ipAddress}:3001). The key was NOT changed — old key remains valid.`,
              actionLabel: 'Check gateway',
            },
          },
        },
      }, `gw:key-rotation-failed:${gw.id}`, 30);

      throw new Error(
        `Rotacja anulowana: nie można połączyć się z gateway (${gw.ipAddress}:3001). ` +
        `Sprawdź czy gateway jest online i spróbuj ponownie.`
      );
    }

    // ── Krok 2: Gateway potwierdził — teraz aktualizuj backend ──
    // secretHashPending = stary hash jako 15-minutowe okno failsafe
    // (np. gdy gateway dostał klucz ale jeszcze się nie zrestartował)
    await this.prisma.gateway.update({
      where: { id },
      data: {
        secretHash:             newSecretHash,
        secretHashPending:      gw.secretHash,
        secretPendingExpiresAt: expiresAt,
      },
    });

    this.logger.log(
      `Gateway ${gw.name}: rotation SUCCESS — gateway confirmed, ` +
      `old secret valid as fallback until ${expiresAt.toISOString()}`
    );

    return {
      secret:         newSecret,
      secretPreview:  newSecret.slice(0, 8) + '…',
      expiresAt,
      gatewayReached,
    };
  }

  /** Cron co 5 min — czyści wygasłe okna rotacji */
  @Cron('0 */5 * * * *')
  async cleanExpiredRotations(): Promise<void> {
    const result = await this.prisma.gateway.updateMany({
      where: {
        secretHashPending:      { not: null },
        secretPendingExpiresAt: { lt: new Date() },
      },
      data: {
        secretHashPending:      null,
        secretPendingExpiresAt: null,
      },
    });
    if (result.count > 0) {
      this.logger.log(`Key rotation: ${result.count} expired window(s) cleaned`);
    }
  }

  private async _pushRotateSecret(ipAddress: string, newSecret: string): Promise<boolean> {
    const url = `http://${ipAddress}:3001/rotate-secret`;
    const key  = this.config.get<string>('GATEWAY_PROVISION_KEY') ?? '';
    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-gateway-secret': key },
        body:    JSON.stringify({ newSecret }),
        signal:  AbortSignal.timeout(8_000),
      });
      if (resp.ok) {
        this.logger.log(`Gateway rotate-secret: HTTP push OK`);
        return true;
      }
      this.logger.warn(`Gateway rotate-secret: HTTP ${resp.status}`);
      return false;
    } catch (err: any) {
      this.logger.warn(`Gateway rotate-secret: cannot reach gateway — ${err.message}`);
      return false;
    }
  }

  async regenerateSecret(id: string) {
    // Legacy: deleguje do rotateSecret
    const result = await this.rotateSecret(id);
    const gw     = await this.prisma.gateway.findUnique({
      where:  { id },
      select: { id: true, name: true, isOnline: true, lastSeen: true, ipAddress: true },
    });
    return { gateway: gw, ...result };
  }

  /**
   * Wyślij komendę do beacona przez gateway HTTP API → lokalny Mosquitto → beacon.
   * Jedyna poprawna droga — backend i Pi mają osobne brokery Mosquitto.
   */
  async triggerUpdate(gatewayId: string, channel = 'main'): Promise<object> {
    const gw = await this.prisma.gateway.findUnique({
      where:  { id: gatewayId },
      select: { ipAddress: true, version: true, name: true },
    });

    if (!gw?.ipAddress) {
      throw new NotFoundException(`Gateway ${gatewayId} nie ma zapisanego adresu IP — wymagany heartbeat`);
    }

    const url = `http://${gw.ipAddress}:3001/update`;
    const key  = this.config.get<string>('GATEWAY_PROVISION_KEY') ?? '';

    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-gateway-secret': key },
        body:    JSON.stringify({ channel }),
        signal:  AbortSignal.timeout(20_000),  // update może chwilę trwać
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Gateway zwrócił HTTP ${resp.status}: ${body}`);
      }

      const result = await resp.json();
      this.logger.log(`OTA update triggered: ${gw.name} ${gw.version} → ${result.newVersion}`);
      return result;
    } catch (err: any) {
      this.logger.warn(`OTA update failed for ${gatewayId}: ${err.message}`);
      throw err;
    }
  }

  async addBeaconCredentials(
    gatewayId: string,
    username:  string,
    password:  string,
    deskId?:   string,  // ← przekazuj desk_id — gateway użyje do wąskiego ACL
  ): Promise<void> {
    const gw = await this.prisma.gateway.findUnique({
      where:  { id: gatewayId },
      select: { ipAddress: true },
    });

    if (!gw?.ipAddress) {
      this.logger.warn(`addBeaconCredentials: brak IP gateway ${gatewayId} — pominięto`);
      return;
    }

    const url = `http://${gw.ipAddress}:3001/beacon/add`;
    const key  = this.config.get<string>('GATEWAY_PROVISION_KEY') ?? '';

    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-gateway-secret': key },
        // desk_id pozwala gateway wygenerować wąski ACL per-biurko (nie desk/#)
        body:    JSON.stringify({ username, password, ...(deskId && { desk_id: deskId }) }),
        signal:  AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        this.logger.log(`MQTT user added via gateway: ${username}`);
      } else {
        this.logger.warn(`Gateway /beacon/add failed: HTTP ${resp.status} — ${username}`);
      }
    } catch (err: any) {
      this.logger.warn(`Cannot reach gateway ${gatewayId}: ${err.message} — ${username} not added`);
    }
  }

  async findGatewayForDesk(deskId: string): Promise<string | null> {
    const device = await this.prisma.device.findFirst({
      where:  { deskId },
      select: { gatewayId: true },
    });
    return device?.gatewayId ?? null;
  }

  async sendBeaconCommand(gatewayId: string, deskId: string, command: string, params?: object): Promise<void> {
    const gw = await this.prisma.gateway.findUnique({
      where:  { id: gatewayId },
      select: { ipAddress: true },
    });

    if (!gw?.ipAddress) {
      this.logger.warn(`sendBeaconCommand: brak IP gateway ${gatewayId} — komenda ${command} pominięta`);
      return;
    }

    const url = `http://${gw.ipAddress}:3001/command`;
    const key = this.config.get<string>('GATEWAY_PROVISION_KEY') ?? '';

    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-gateway-secret': key },
        body:    JSON.stringify({ deskId, command, params }),
        signal:  AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        this.logger.log(`Komenda wysłana przez gateway: ${command} → desk/${deskId}`);
      } else {
        this.logger.warn(`Gateway odrzucił komendę: HTTP ${resp.status} — ${command} → desk/${deskId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Brak połączenia z gateway ${gatewayId}: ${err.message} — ${command} pominięta`);
    }
  }
}
