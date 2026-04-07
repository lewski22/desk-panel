import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService }    from '../../database/prisma.service';
import { GatewaysService } from '../gateways/gateways.service';
import { EventType } from '@prisma/client';

export interface ProvisionDeviceDto {
  hardwareId: string;
  deskId?: string;
  gatewayId: string;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  constructor(
    private prisma:    PrismaService,
    private gateways:  GatewaysService,
  ) {}

  async provision(dto: ProvisionDeviceDto) {
    const exists = await this.prisma.device.findUnique({
      where: { hardwareId: dto.hardwareId },
    });
    if (exists) throw new ConflictException('Device already provisioned');

    const mqttPassword     = randomBytes(20).toString('hex');
    const mqttPasswordHash = await bcrypt.hash(mqttPassword, 10);
    const mqttUsername     = `beacon-${dto.hardwareId}`;

    const device = await this.prisma.device.create({
      data: { hardwareId: dto.hardwareId, mqttUsername, mqttPasswordHash, gatewayId: dto.gatewayId, deskId: dto.deskId },
    });

    await this.prisma.event.create({
      data: {
        type: EventType.DEVICE_PROVISIONED,
        entityType: 'device',
        entityId: device.id,
        payload: { hardwareId: dto.hardwareId, gatewayId: dto.gatewayId },
      },
    });

    // ── Notify gateway to add MQTT user automatically ────────
    await this.gateways.addBeaconCredentials(dto.gatewayId, mqttUsername, mqttPassword);

    return { device, mqttUsername, mqttPassword };
  }


  async findAll(gatewayId?: string) {
    return this.prisma.device.findMany({
      where: gatewayId ? { gatewayId } : undefined,
      include: { desk: { select: { id: true, name: true, code: true } } },
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

  // FIX: combine heartbeat + firmwareVersion into one query (was 2 separate calls from MQTT handler)
  async heartbeat(hardwareId: string, rssi?: number, firmwareVersion?: string) {
    return this.prisma.device.update({
      where: { hardwareId },
      data:  {
        isOnline: true,
        lastSeen: new Date(),
        ...(rssi !== undefined && { rssi }),
        ...(firmwareVersion    && { firmwareVersion }),
      },
    });
  }


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


  /**
   * Pobiera najnowszą wersję firmware z GitHub Releases.
   * Zwraca { version, url, size, publishedAt } lub null jeśli brak releases.
   */
  async getLatestFirmware(): Promise<{
    version: string; url: string; size: number; publishedAt: string;
  } | null> {
    const repo = 'lewski22/desk-firmware';
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

    try {
      const resp = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal:  AbortSignal.timeout(8000),
      });

      if (resp.status === 404) return null;  // No releases yet
      if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);

      const data = await resp.json();
      const tag  = (data.tag_name as string).replace(/^v/, '');

      // Find the .bin asset for esp32dev
      const asset = (data.assets as any[]).find(
        (a: any) => a.name.endsWith('-esp32dev.bin')
      );
      if (!asset) return null;

      return {
        version:     tag,
        url:         asset.browser_download_url,
        size:        asset.size,
        publishedAt: data.published_at,
      };
    } catch (err: any) {
      this.logger.warn(`GitHub firmware API failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Wysyła komendę OTA_UPDATE do beacona przez gateway.
   * Beacon pobiera .bin z GitHub Releases i flashuje się.
   */
  async triggerOta(deviceId: string) {
    const [device, firmware] = await Promise.all([
      this.findOne(deviceId),
      this.getLatestFirmware(),
    ]);

    if (!firmware) {
      throw new BadRequestException('Brak dostępnych releases firmware — opublikuj release na GitHub');
    }

    const current = device.firmwareVersion ?? '0.0.0';
    this.logger.log(`OTA trigger: ${device.hardwareId} ${current} → ${firmware.version}`);

    // Wyślij komendę przez GatewaysService.sendBeaconCommand
    // (importujemy dynamicznie żeby uniknąć circular dep z GatewaysModule)
    return {
      triggered:  true,
      deviceId,
      hardwareId: device.hardwareId,
      from:       current,
      to:         firmware.version,
      url:        firmware.url,
      // Rzeczywiste wysłanie komendy robi kontroler przez GatewaysService
      _ota_payload: {
        command: 'OTA_UPDATE',
        params: { url: firmware.url, version: firmware.version },
      },
    };
  }

  async remove(id: string) {
    await this.prisma.device.delete({ where: { id } });
    return { deleted: true };
  }
}
