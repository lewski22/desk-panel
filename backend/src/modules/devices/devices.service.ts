/**
 * DevicesService — zarządzanie beaconami BLE (urządzeniami biurek).
 *
 * Beacon to urządzenie IoT zamontowane na biurku, komunikujące się przez
 * BLE → Gateway (MQTT) → Backend. Serwis obsługuje:
 * - Provisioning: rejestracja beacona przez gateway (upsert hardwareId),
 *   generowanie jednorazowych danych MQTT (username + hasło hashowane bcrypt)
 * - Przypisanie biurka (SET_DESK_ID), zmianę bramki, aktualizację firmware
 * - OTA (Over-The-Air) update: sprawdzanie dostępności nowego firmware z GitHub Releases
 * - Odszyfrowywanie WiFi (WifiCryptoService) i przekazywanie do beacona przy provisioning
 * - CRON: wykrywanie beaconów offline (brak heartbeat > threshold z config)
 *
 * backend/src/modules/devices/devices.service.ts
 */
import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService }   from '@nestjs/config';
import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional }         from '@nestjs/swagger';
import { randomBytes }     from 'crypto';
import { PrismaService }   from '../../database/prisma.service';
import { GatewaysService } from '../gateways/gateways.service';
import { InAppNotificationsService, InAppNotifType } from '../inapp-notifications/inapp-notifications.service';
import { WifiCryptoService } from '../crypto/wifi-crypto.service';
import * as bcrypt from 'bcrypt';

// Dozwolone znaki spójne z _SAFE_MQTT_ID w gateway.py.
// hardwareId może zawierać dwukropki (format MAC: AA:BB:CC:DD:EE:FF).
const HARDWARE_ID_REGEX = /^[a-zA-Z0-9:_\-\.]{1,64}$/;
// gatewayId i deskId to CUIDs/UUIDs — bez dwukropków.
const CUID_SAFE_REGEX    = /^[a-zA-Z0-9_\-]{1,128}$/;

export class ProvisionDeviceDto {
  @ApiProperty({ example: 'AABBCCDDEEFF', description: 'Hardware ID beacona (MAC lub hex)' })
  @IsString()
  @Matches(HARDWARE_ID_REGEX, {
    message: 'hardwareId może zawierać tylko litery, cyfry, dwukropek, podkreślnik, myślnik i kropkę (max 64 znaki)',
  })
  hardwareId: string;

  @ApiProperty({ description: 'CUID gateway' })
  @IsString()
  @Matches(CUID_SAFE_REGEX, { message: 'gatewayId zawiera niedozwolone znaki' })
  gatewayId: string;

  @ApiPropertyOptional({ description: 'CUID biurka (opcjonalne przy provisioning)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(CUID_SAFE_REGEX, { message: 'deskId zawiera niedozwolone znaki' })
  deskId?: string;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma:      PrismaService,
    private gateways:    GatewaysService,
    private config:      ConfigService,
    private inapp:       InAppNotificationsService,
    private wifiCrypto:  WifiCryptoService,
  ) {}

  // ── Provisioning ──────────────────────────────────────────────
  async provision(dto: ProvisionDeviceDto) {
    const mqttUsername    = `beacon_${dto.hardwareId}`;
    const mqttPassword    = randomBytes(24).toString('hex');
    const mqttPasswordHash = await bcrypt.hash(mqttPassword, 10);

    const device = await this.prisma.device.upsert({
      where:  { hardwareId: dto.hardwareId },
      update: { gatewayId: dto.gatewayId, ...(dto.deskId && { deskId: dto.deskId }) },
      create: {
        hardwareId: dto.hardwareId, mqttUsername, mqttPasswordHash,
        gatewayId: dto.gatewayId, deskId: dto.deskId,
      },
      include: { desk: { select: { id: true } } },
    });

    await this.prisma.event.create({
      data: { type: 'DEVICE_PROVISIONED' as any, entityType: 'device', payload: { hardwareId: dto.hardwareId, gatewayId: dto.gatewayId } },
    }).catch(() => {});

    await this.gateways.addBeaconCredentials(dto.gatewayId, mqttUsername, mqttPassword, dto.deskId);

    const gateway = await this.prisma.gateway.findUnique({
      where:   { id: dto.gatewayId },
      include: { location: { select: { wifiSsidEnc: true, wifiPassEnc: true } } },
    });

    const wifiSsid = gateway?.location?.wifiSsidEnc
      ? this.wifiCrypto.decrypt(gateway.location.wifiSsidEnc)
      : null;
    const wifiPass = gateway?.location?.wifiPassEnc
      ? this.wifiCrypto.decrypt(gateway.location.wifiPassEnc)
      : null;

    const mqttHost = gateway?.ipAddress ?? process.env.MQTT_HOST ?? '';
    const mqttPort = parseInt(process.env.MQTT_PORT ?? '1883', 10);

    return {
      deviceId:     device.id,
      hardwareId:   device.hardwareId,
      mqttUsername,
      mqttPassword,
      mqttHost,
      mqttPort,
      deskId:       device.deskId   ?? '',
      gatewayId:    device.gatewayId ?? '',
      wifiSsid,
      wifiPass,
      wifiMissing:  !wifiSsid,
    };
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async findAll(organizationId?: string) {
    const where = organizationId
      ? {
          OR: [
            { gateway: { location: { organizationId } } },
            { desk:    { location: { organizationId } } },
          ],
        }
      : undefined;

    return this.prisma.device.findMany({
      where,
      include: { desk: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.device.findUnique({
      where: { id },
      include: { desk: true, gateway: true },
    });
    if (!d) throw new NotFoundException(`Device ${id} not found`);
    return d;
  }

  // ── Org isolation guard ───────────────────────────────────────
  // Waliduje Device → Gateway → Location → organizationId
  // Rzuca ForbiddenException jeśli beacon nie należy do tej org.
  async assertBelongsToOrg(deviceId: string, organizationId: string) {
    const device = await this.prisma.device.findUnique({
      where:   { id: deviceId },
      include: { gateway: { include: { location: true } } },
    });
    if (!device) throw new NotFoundException(`Device ${deviceId} not found`);

    const devOrgId = device.gateway?.location?.organizationId;
    if (!devOrgId || devOrgId !== organizationId) {
      this.logger.warn(
        `OTA org guard: device ${deviceId} (org: ${devOrgId}) ` +
        `rejected for actor org: ${organizationId}`
      );
      throw new ForbiddenException('Beacon nie należy do Twojej organizacji');
    }
    return device;
  }

  // ── Assign desk ───────────────────────────────────────────────
  async assignToDesk(id: string, deskId: string) {
    const device = await this.findOne(id);
    const updated = await this.prisma.device.update({
      where: { id },
      data:  { deskId },
      include: { desk: { select: { id: true } } },
    });

    const oldTopic = device.deskId ? `desk/${device.deskId}/command` : 'desk//command';
    this.logger.log(`assignToDesk: ${device.hardwareId} → ${deskId}`);

    return { updated, setDeskIdTopic: oldTopic, newDeskId: deskId };
  }

  // ── Heartbeat ─────────────────────────────────────────────────
  async heartbeat(hardwareId: string, rssi?: number, firmwareVersion?: string) {
    const device = await this.prisma.device.update({
      where: { hardwareId },
      data:  {
        isOnline:  true,
        lastSeen:  new Date(),
        ...(rssi !== undefined && { rssi }),
        ...(firmwareVersion    && { firmwareVersion }),
      },
    });

    // OTA korelacja: jeśli beacon zameldował nową wersję = aktualizacja się powiodła
    if (
      firmwareVersion &&
      device.otaStatus === 'in_progress' &&
      device.otaVersion === firmwareVersion
    ) {
      await this.prisma.device.update({
        where: { id: device.id },
        data:  {
          otaStatus:    'success',
          otaFinishedAt: new Date(),
        },
      });
      this.logger.log(`OTA success: ${hardwareId} → v${firmwareVersion}`);
    }

    return device;
  }

  // ── OTA: trigger dla pojedynczego beacona ─────────────────────
  async triggerOta(deviceId: string, actorOrgId?: string) {
    // Jeśli actorOrgId podany → sprawdź izolację org
    let device = actorOrgId
      ? await this.assertBelongsToOrg(deviceId, actorOrgId)
      : await this.findOne(deviceId);

    // Guard: nie zezwalaj na podwójny OTA
    if (device.otaStatus === 'in_progress') {
      throw new ConflictException(
        'Aktualizacja już w toku — poczekaj na zakończenie lub reset beacon'
      );
    }

    // Guard: beacon musi mieć przypisane biurko (inaczej brak topicu MQTT)
    if (!device.deskId) {
      throw new BadRequestException(
        'Beacon nie jest przypisany do biurka — nie można wysłać komendy OTA'
      );
    }

    const firmware = await this.getLatestFirmware();
    if (!firmware) {
      throw new BadRequestException(
        'Brak dostępnych releases firmware — opublikuj release na GitHub'
      );
    }

    const currentVer = device.firmwareVersion ?? '0.0.0';
    this.logger.log(`OTA trigger: ${device.hardwareId} ${currentVer} → ${firmware.version}`);

    // Zapisz status przed wysłaniem komendy
    await this.prisma.device.update({
      where: { id: deviceId },
      data:  {
        otaStatus:   'in_progress',
        otaVersion:  firmware.version,
        otaStartedAt: new Date(),
        otaFinishedAt: null,
      },
    });

    return {
      triggered:   true,
      deviceId,
      hardwareId:  device.hardwareId,
      gatewayId:   device.gatewayId,
      deskId:      device.deskId,
      from:        currentVer,
      to:          firmware.version,
      _ota_payload: {
        command: 'OTA_UPDATE',
        params:  { url: firmware.url, version: firmware.version, sha256: firmware.sha256 },
      },
    };
  }

  // ── OTA: aktualizacja wszystkich outdated beaconów w org ──────
  async triggerOtaAll(actorOrgId: string, locationId?: string) {
    const firmware = await this.getLatestFirmware();
    if (!firmware) {
      throw new BadRequestException('Brak dostępnych releases firmware');
    }

    // Znajdź wszystkie outdated beacony w org (lub konkretnej lokalizacji)
    const devices = await this.prisma.device.findMany({
      where: {
        gateway: {
          location: {
            organizationId: actorOrgId,
            ...(locationId ? { id: locationId } : {}),
          },
        },
        deskId:   { not: null },          // musi mieć biurko (topic MQTT)
        otaStatus: { not: 'in_progress' }, // pomiń te co już się aktualizują
        NOT: { firmwareVersion: firmware.version }, // tylko outdated
      },
      include: { gateway: { select: { id: true } } },
    });

    if (!devices.length) return { queued: 0, version: firmware.version };

    this.logger.log(
      `OTA-all: queuing ${devices.length} device(s) → v${firmware.version} (org: ${actorOrgId})`
    );

    // Oznacz wszystkie jako in_progress przed wysłaniem komend
    const now = new Date();
    await this.prisma.device.updateMany({
      where: { id: { in: devices.map(d => d.id) } },
      data: {
        otaStatus:    'in_progress',
        otaVersion:   firmware.version,
        otaStartedAt: now,
        otaFinishedAt: null,
      },
    });

    // Wyślij komendy z 5s opóźnieniem między każdym — nie przeciążaj sieci
    let sent = 0;
    for (const dev of devices) {
      try {
        await this.gateways.sendBeaconCommand(
          dev.gateway!.id,
          dev.deskId!,
          'OTA_UPDATE',
          { url: firmware.url, version: firmware.version, sha256: firmware.sha256 },
        );
        sent++;
      } catch (e: any) {
        this.logger.warn(`OTA-all: failed to send to ${dev.hardwareId}: ${e.message}`);
        await this.prisma.device.update({
          where: { id: dev.id },
          data:  { otaStatus: 'failed', otaFinishedAt: new Date() },
        });
        // Powiadomienie in-app o błędzie OTA
        const device = devices.find(d => d.id === dev.id) as any;
        const orgId  = device?.gateway?.location?.organizationId ?? actorOrgId;
        if (orgId) {
          this.inapp.create({
            type:           InAppNotifType.FIRMWARE_UPDATE,
            title:          `OTA nieudane — ${dev.hardwareId}`,
            body:           `Nie można wysłać komendy OTA do beacona ${dev.hardwareId}. Gateway może być niedostępny.`,
            organizationId: orgId,
            targetRoles:    ['SUPER_ADMIN', 'OFFICE_ADMIN'],
            actionUrl:      '/provisioning',
            actionLabel:    'Provisioning',
            meta:           { deviceId: dev.id, hardwareId: dev.hardwareId, error: e.message },
          }, `inapp:ota:fail:${dev.id}`, 60).catch(() => {});
        }
      }

      if (sent < devices.length) {
        await new Promise(r => setTimeout(r, 5000)); // 5s throttle
      }
    }

    return { queued: sent, total: devices.length, version: firmware.version };
  }

  // ── Cron: timeout OTA po 10 minutach ─────────────────────────
  @Cron('0 */10 * * * *')
  async timeoutStaleOta() {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);

    const stale = await this.prisma.device.findMany({
      where: { otaStatus: 'in_progress', otaStartedAt: { lt: cutoff } },
      include: {
        desk:    { include: { location: { select: { organizationId: true } } } },
        gateway: { include: { location: { select: { organizationId: true } } } },
      },
    });

    if (!stale.length) return;

    await this.prisma.device.updateMany({
      where: { id: { in: stale.map(d => d.id) } },
      data:  { otaStatus: 'failed', otaFinishedAt: new Date() },
    });

    this.logger.warn(`OTA timeout: marked ${stale.length} device(s) as failed`);

    for (const dev of stale) {
      const orgId = dev.gateway?.location?.organizationId ?? dev.desk?.location?.organizationId;
      if (!orgId) continue;
      await this.inapp.create({
        type:           InAppNotifType.FIRMWARE_UPDATE,
        title:          `OTA timeout — ${dev.desk?.name ?? dev.hardwareId}`,
        body:           `Aktualizacja firmware beacona "${dev.desk?.name ?? dev.hardwareId}" przekroczyła limit czasu i została anulowana. Sprawdź połączenie urządzenia.`,
        organizationId: orgId,
        targetRoles:    ['SUPER_ADMIN', 'OFFICE_ADMIN'],
        actionUrl:      '/provisioning',
        actionLabel:    'Provisioning',
        meta:           { deviceId: dev.id, hardwareId: dev.hardwareId },
      }, `inapp:ota:timeout:${dev.id}`, 60);
    }
  }

  // ── GitHub Releases ───────────────────────────────────────────
  async getLatestFirmware(): Promise<{
    version: string; url: string; sha256: string; size: number; publishedAt: string;
  } | null> {
    const repo   = this.config.get<string>('FIRMWARE_REPO', 'lewski22/desk-firmware');
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

    try {
      const resp = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal:  AbortSignal.timeout(8000),
      });

      if (resp.status === 404) return null;
      if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);

      const data  = await resp.json() as any;
      const tag   = (data.tag_name as string).replace(/^v/, '');
      const assets: any[] = data.assets as any[];

      const binAsset = assets.find((a: any) => a.name.endsWith('-esp32dev.bin'))
        ?? assets.find((a: any) => a.name.endsWith('.bin'));

      if (!binAsset) return null;

      // Fetch manifest.json from the same release for SHA-256.
      // manifest.json is generated by .github/workflows/release.yml alongside the .bin.
      const manifestAsset = assets.find((a: any) => a.name === 'manifest.json');
      let sha256 = '';
      if (manifestAsset) {
        try {
          const mResp = await fetch(manifestAsset.browser_download_url, {
            signal: AbortSignal.timeout(5000),
          });
          if (mResp.ok) {
            const manifest = await mResp.json() as any;
            sha256 = manifest.sha256 ?? '';
          }
        } catch (err: any) {
          this.logger.warn(`Firmware manifest fetch failed: ${err.message}`);
        }
      }

      if (!sha256) {
        this.logger.warn('Firmware release has no manifest.json — OTA_UPDATE will be sent without sha256');
      }

      return {
        version:     tag,
        url:         binAsset.browser_download_url,
        sha256,
        size:        binAsset.size,
        publishedAt: data.published_at,
      };
    } catch (err: any) {
      this.logger.warn(`GitHub firmware API failed: ${err.message}`);
      return null;
    }
  }

  async remove(id: string) {
    await this.prisma.device.delete({ where: { id } });
    return { deleted: true };
  }
}
