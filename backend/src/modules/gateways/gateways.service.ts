/**
 * GatewaysService — zarządzanie bramkami MQTT i komunikacja z beaconami.
 *
 * Gateway (Raspberry Pi) łączy się z backendem przez MQTT i przekazuje
 * skany NFC oraz dane heartbeat z beaconów. Serwis odpowiada za:
 * - Rejestrację bramki (secret hashowany, nigdy nie przechowywany jawnie)
 * - Autentykację bramki przy każdym połączeniu MQTT
 * - Odbieranie heartbeat z beaconów i aktualizację statusu online/offline
 * - Rozsyłanie komend LED do beaconów przez MQTT (subskrypcja events$ z LedEventsService)
 * - CRON co minutę: wykrywanie bramek offline (brak heartbeat > 90s)
 *
 * backend/src/modules/gateways/gateways.service.ts
 */
import { Injectable, Logger, NotFoundException, UnauthorizedException, ForbiddenException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService }             from '../../database/prisma.service';
import { InAppNotificationsService } from '../inapp-notifications/inapp-notifications.service';
import { LedEventsService }          from '../../shared/led-events.service';
import { GatewayCommandsService }    from './gateway-commands.service';
import { EventType } from '@prisma/client';

@Injectable()
export class GatewaysService implements OnModuleDestroy {
  private readonly logger = new Logger(GatewaysService.name);
  private readonly _verifyIntervals = new Set<ReturnType<typeof setInterval>>();

  constructor(
    private prisma:           PrismaService,
    private config:           ConfigService,
    private inapp:            InAppNotificationsService,
    private ledEvents:        LedEventsService,
    private gatewayCommands:  GatewayCommandsService,
  ) {}

  onModuleDestroy(): void {
    for (const interval of this._verifyIntervals) clearInterval(interval);
    this._verifyIntervals.clear();
  }

  async register(locationId: string, name: string) {
    // FIX: crypto.randomBytes instead of Math.random()
    const secret     = randomBytes(24).toString('hex');
    const secretHash = await bcrypt.hash(secret, 10);

    const gateway = await this.prisma.gateway.create({
      data: { locationId, name, secretHash, secretRaw: secret },
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

  async deviceHeartbeat(deviceId: string, rssi?: number, firmwareVersion?: string, isOnline?: boolean) {
    const online = isOnline === false ? false : true;

    // Snapshot przed updatem — potrzebny do wykrycia powrotu online
    // Lookup po Device.id (CUID) — beacon wysyła device_id z NVS po provisioning
    const prev = await this.prisma.device.findUnique({
      where:  { id: deviceId },
      select: { isOnline: true, deskId: true, id: true, lastSeen: true },
    });

    if (!prev) {
      this.logger.warn(
        `deviceHeartbeat: device not found — id=${deviceId}. ` +
        `Beacon NVS may be stale or device was deleted. Re-provisioning required.`
      );
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    const device = await this.prisma.device.update({
      where: { id: deviceId },
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
      this.logger.log(`OTA success confirmed by heartbeat: ${deviceId} v${firmwareVersion}`);
    }

    // LED recovery: beacon wrócił online po przerwie lub restarcie.
    // Warunek: (był offline) LUB (był online, ale lastSeen > 3× interwał heartbeatu — restart niewykryty przez brak LWT)
    const RESTART_GAP_MS = 90_000; // 3× interwał 30s
    const gapSinceLastSeen = prev.lastSeen
      ? Date.now() - prev.lastSeen.getTime()
      : Infinity;
    const likelyRestart = prev.isOnline && gapSinceLastSeen > RESTART_GAP_MS;

    if (online && prev.deskId && (!prev.isOnline || likelyRestart)) {
      this.restoreDeskLed(prev.deskId).catch(() => {});
    }

    return device;
  }

  async restoreDeskLed(deskId: string): Promise<void> {
    const activeCheckin = await this.prisma.checkin.findFirst({
      where:  { deskId, checkedOutAt: null },
      select: { id: true },
    });
    if (activeCheckin) {
      this.ledEvents.emit(deskId, 'OCCUPIED');
      return;
    }

    const now = new Date();
    const candidate = await this.prisma.reservation.findFirst({
      where: {
        deskId,
        status:  { in: ['CONFIRMED', 'PENDING'] },
        endTime: { gte: now },
      },
      select: {
        id:        true,
        startTime: true,
        desk: { select: { location: { select: { openTime: true, timezone: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });

    let isReserved = false;
    if (candidate) {
      const tz       = candidate.desk?.location?.timezone ?? 'Europe/Warsaw';
      const openTime = candidate.desk?.location?.openTime;
      const fmtDate  = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
      if (fmtDate(now) === fmtDate(candidate.startTime)) {
        if (openTime) {
          const toMin  = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
          const parts  = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).formatToParts(now);
          const nowMin = toMin(`${parts.find(p => p.type === 'hour')?.value ?? '0'}:${parts.find(p => p.type === 'minute')?.value ?? '0'}`);
          isReserved   = nowMin >= toMin(openTime);
        } else {
          isReserved = true;
        }
      }
    }

    this.ledEvents.emit(deskId, isReserved ? 'RESERVED' : 'FREE');
    this.logger.log(`LED restored: desk ${deskId} → ${isReserved ? 'RESERVED' : 'FREE'}`);
  }

  // ── Cron: co godzinę ustaw RESERVED dla biurek, których rezerwacja "dojrzała" ──
  @Cron('0 0 * * * *')
  async autoReservedLed() {
    const now = new Date();
    const candidates = await this.prisma.reservation.findMany({
      where: {
        status:    { in: ['CONFIRMED', 'PENDING'] },
        endTime:   { gte: now },
        startTime: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: {
        deskId:          true,
        startTime:       true,
        reservationType: true,
        desk: { select: { location: { select: { openTime: true, timezone: true } } } },
      },
    });

    const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const eligible = new Map<string, 'RESERVED' | 'GUEST_RESERVED'>();

    for (const r of candidates) {
      const tz       = r.desk?.location?.timezone ?? 'Europe/Warsaw';
      const openTime = r.desk?.location?.openTime;
      const fmtDate  = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
      if (fmtDate(now) !== fmtDate(r.startTime)) continue;
      if (openTime) {
        const parts  = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).formatToParts(now);
        const nowMin = toMin(`${parts.find(p => p.type === 'hour')?.value ?? '0'}:${parts.find(p => p.type === 'minute')?.value ?? '0'}`);
        if (nowMin < toMin(openTime)) continue;
      }
      const state = (r.reservationType === 'GUEST' || r.reservationType === 'TEAM') ? 'GUEST_RESERVED' : 'RESERVED';
      eligible.set(r.deskId, state);
    }

    if (eligible.size === 0) return;

    const activeCheckins = await this.prisma.checkin.findMany({
      where: { deskId: { in: [...eligible.keys()] }, checkedOutAt: null },
      select: { deskId: true },
    });
    const occupied = new Set(activeCheckins.map(c => c.deskId));

    let count = 0;
    for (const [deskId, state] of eligible) {
      if (!occupied.has(deskId)) { this.ledEvents.emit(deskId, state); count++; }
    }
    if (count > 0) this.logger.log(`Auto-reserved LED: ${count} desk(s) set to RESERVED`);
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
   * Two-phase secret rotation via SSE.
   *
   * Phase 1 (prepare): backend sends newSecret + HMAC to gateway.
   *   Gateway verifies HMAC and writes GATEWAY_SECRET_PENDING to .env.
   *   ACK must arrive before phase 2 proceeds.
   *
   * Phase 2 (commit): backend writes new secretHash to DB, then sends commit.
   *   Gateway promotes PENDING → active and restarts.
   *
   * Phase 3 (verify): async polling for 5 minutes to confirm reconnect.
   *   Logs error if gateway doesn't reconnect — manual intervention required.
   *
   * Invariant: secretHash is never updated in DB without a successful prepare ACK.
   */
  async rotateSecret(id: string, actorOrgId?: string): Promise<{ secretPreview: string }> {
    await this.assertGatewayInOrg(id, actorOrgId);

    const gw = await this.prisma.gateway.findUnique({
      where:  { id },
      select: { id: true, name: true, secretHash: true },
    });
    if (!gw) throw new NotFoundException('Gateway not found');

    if (!this.gatewayCommands.isConnected(id)) {
      throw new BadRequestException(
        `Gateway ${id} is not connected via SSE — cannot rotate secret safely`
      );
    }

    const newSecret     = randomBytes(32).toString('hex');   // 64 hex chars
    const newSecretHash = await bcrypt.hash(newSecret, 10);

    // ── Phase 1: Prepare ─────────────────────────────────────
    // The SSE channel is already authenticated via JWT — no separate HMAC needed.
    // Backend no longer stores secretRaw (plaintext), so HMAC(newSecret, currentSecret)
    // is impossible without a plaintext key. JWT auth of the SSE stream is sufficient.
    this.logger.log(`rotate_secret: phase 1 (prepare) — gatewayId=${id}`);
    await this.gatewayCommands.publish(
      id,
      'rotate_secret_prepare',
      { newSecret },
      15_000,
    );
    this.logger.log(`rotate_secret: prepare ACK received — gatewayId=${id}`);

    // ── Phase 2: Commit ──────────────────────────────────────
    // Update DB only after gateway confirmed PENDING is written.
    // Keep old hash in secretHashPending for a 15-min overlap window.
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.gateway.update({
      where: { id },
      data: {
        secretHash:             newSecretHash,
        // secretHashPending holds the OLD secretHash so the overlap window can
        // still validate the old secret during the 15-min grace period.
        secretHashPending:      gw.secretHash ?? undefined,
        secretPendingExpiresAt: expiresAt,
      },
    });
    this.logger.log(`rotate_secret: new secretHash saved in DB — gatewayId=${id}`);

    // Send commit — gateway will restart ~2s after ACK is dispatched.
    // If ACK doesn't arrive (gateway restarted before sending), phase 3 verifies.
    try {
      await this.gatewayCommands.publish(id, 'rotate_secret_commit', {}, 15_000);
      this.logger.log(`rotate_secret: commit ACK received — gatewayId=${id}`);
    } catch (err: any) {
      // Timeout here is expected if gateway restarts before ACK reaches backend.
      this.logger.warn(
        `rotate_secret: commit ACK timeout (gateway likely restarted) — ${err.message}`
      );
    }

    // ── Phase 3: Async verify ────────────────────────────────
    this._scheduleSecretVerification(id);

    return { secretPreview: newSecret.slice(0, 8) + '…' };
  }

  private _scheduleSecretVerification(gatewayId: string): void {
    const maxAttempts = 10;    // 10 × 30s = 5 minutes
    const intervalMs  = 30_000;
    let   attempts    = 0;

    const interval = setInterval(() => {
      attempts++;
      if (this.gatewayCommands.isConnected(gatewayId)) {
        this.logger.log(
          `rotate_secret: verify OK — gateway ${gatewayId} reconnected with new secret`
        );
        clearInterval(interval);
        this._verifyIntervals.delete(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        this._verifyIntervals.delete(interval);
        this.logger.error(
          `rotate_secret: VERIFY FAILED — gateway ${gatewayId} did not reconnect ` +
          `within 5 minutes after secret rotation. Manual intervention required.`
        );
      }
    }, intervalMs);
    this._verifyIntervals.add(interval);
  }

  /** Cron every 5 min — clean expired rotation overlap windows */
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

  async regenerateSecret(id: string) {
    // Legacy alias
    const result = await this.rotateSecret(id);
    const gw     = await this.prisma.gateway.findUnique({
      where:  { id },
      select: { id: true, name: true, isOnline: true, lastSeen: true, ipAddress: true },
    });
    return { gateway: gw, ...result };
  }

  /**
   * Triggers an OTA update by sending the signed manifest URL to the gateway via SSE.
   * Gateway fetches the manifest, verifies the Ed25519 signature, and applies the update.
   * Backend is only a messenger — cannot forge OTA even with full DB access.
   *
   * @param manifestUrl  Full URL to manifest.json from GitHub Releases
   *                     (e.g. https://github.com/org/repo/releases/download/v1.3.0/manifest.json)
   */
  async triggerUpdate(gatewayId: string, manifestUrl: string): Promise<void> {
    if (!this.gatewayCommands.isConnected(gatewayId)) {
      throw new NotFoundException(`Gateway ${gatewayId} is not connected via SSE`);
    }

    // OTA needs a generous timeout — RPi Zero 2W downloading over slow WiFi
    await this.gatewayCommands.publish(
      gatewayId,
      'ota_update',
      { manifestUrl },
      60_000,
    );

    this.logger.log(`OTA update triggered via SSE — gatewayId=${gatewayId} manifestUrl=${manifestUrl}`);
  }

  async addBeaconCredentials(
    gatewayId: string,
    username:  string,
    password:  string,
    deskId?:   string,
  ): Promise<void> {
    if (this.gatewayCommands.isConnected(gatewayId)) {
      await this.gatewayCommands.publish(
        gatewayId,
        'beacon_add',
        { username, password, deskId: deskId ?? null },
        10_000,
      );
      return;
    }

    this.logger.warn(
      `addBeaconCredentials: gateway ${gatewayId} not connected via SSE — ` +
      `beacon provisioning skipped. Gateway must reconnect.`,
    );
  }

  async findGatewayForDesk(deskId: string): Promise<string | null> {
    const device = await this.prisma.device.findFirst({
      where:  { deskId },
      select: { gatewayId: true },
    });
    return device?.gatewayId ?? null;
  }

  async sendBeaconCommand(gatewayId: string, deskId: string, command: string, params?: object): Promise<void> {
    if (!this.gatewayCommands.isConnected(gatewayId)) {
      this.logger.warn(
        `sendBeaconCommand: gateway ${gatewayId} offline — command ${command} dropped`,
      );
      return;
    }

    // Fire-and-forget (timeoutMs=0) — LED commands are best-effort
    await this.gatewayCommands.publish(
      gatewayId,
      'command',
      { deskId, command, params: params ?? null },
      0,
    );
  }
}
