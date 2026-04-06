import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { MqttService } from '../../mqtt/mqtt.service';
import { TOPICS } from '../../mqtt/topics';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
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
    private prisma:  PrismaService,
    private config:  ConfigService,
    private mqtt:    MqttService,
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
    await this._notifyGateway(dto.gatewayId, mqttUsername, mqttPassword);

    return { device, mqttUsername, mqttPassword };
  }

  // Push MQTT credentials to gateway's local Mosquitto
  private async _notifyGateway(gatewayId: string, username: string, password: string) {
    try {
      const gw = await this.prisma.gateway.findUnique({
        where:  { id: gatewayId },
        select: { ipAddress: true, secretHash: true, id: true },
      });
      if (!gw?.ipAddress) {
        this.logger.warn('Gateway has no IP — cannot push MQTT credentials', { gatewayId });
        return;
      }

      // Gateway API is on port 3001
      const url = `http://${gw.ipAddress}:3001/beacon/add`;

      // We need the plain secret — it's in the DB as hash, so we use a special gateway-provision header
      // Gateway authenticates via x-gateway-secret which we fetch from env for the specific gateway
      // For now use a shared provisioning key via env
      const provisionKey = this.config.get<string>('GATEWAY_PROVISION_KEY') ?? '';

      const resp = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-gateway-secret':  provisionKey,
        },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(5000),
      });

      if (resp.ok) {
        this.logger.log('Gateway notified — MQTT user added', { username });
      } else {
        this.logger.warn('Gateway notification failed', { status: resp.status });
      }
    } catch (err: any) {
      // Non-fatal — admin can add manually or restart gateway for sync
      this.logger.warn('Could not reach gateway API — MQTT user NOT added automatically', {
        err: err.message,
        tip: 'Add manually on Pi: docker exec desk_mqtt mosquitto_passwd -b /mosquitto/config/passwd ' + username + ' <password>',
      });
    }
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

  async markOffline(hardwareId: string) {
    return this.prisma.device.update({
      where: { hardwareId },
      data:  { isOnline: false },
    });
  }

  async assignToDesk(id: string, deskId: string) {
    // FIX: single update — if device doesn't exist Prisma throws P2025, no pre-fetch needed
    return this.prisma.device.update({ where: { id }, data: { deskId } });
  }

  async sendCommand(deviceId: string, command: 'SET_LED' | 'REBOOT' | 'IDENTIFY', params?: object) {
    const device = await this.findOne(deviceId);
    if (!device.desk?.id) {
      throw new NotFoundException('Beacon nie jest przypisany do biurka — nie można wysłać komendy MQTT');
    }
    const payload = { command, params, ts: Date.now() };
    this.mqtt.publish(TOPICS.COMMAND(device.desk.id), payload);
    this.logger.log(`Command → desk/${device.desk.id}: ${command}`);
    return { sent: true, command, deskId: device.desk.id };
  }

  async remove(id: string) {
    await this.prisma.device.delete({ where: { id } });
    return { deleted: true };
  }
}
