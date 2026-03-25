import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { EventType } from '@prisma/client';

export interface ProvisionDeviceDto {
  hardwareId: string;
  deskId?: string;
  gatewayId: string;
}

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async provision(dto: ProvisionDeviceDto) {
    const exists = await this.prisma.device.findUnique({
      where: { hardwareId: dto.hardwareId },
    });
    if (exists) throw new ConflictException('Device already provisioned');

    const mqttPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const mqttPasswordHash = await bcrypt.hash(mqttPassword, 10);
    const mqttUsername = `beacon-${dto.hardwareId}`;

    const device = await this.prisma.device.create({
      data: {
        hardwareId: dto.hardwareId,
        mqttUsername,
        mqttPasswordHash,
        gatewayId: dto.gatewayId,
        deskId: dto.deskId,
      },
    });

    await this.prisma.event.create({
      data: {
        type: EventType.DEVICE_PROVISIONED,
        entityType: 'device',
        entityId: device.id,
        payload: { hardwareId: dto.hardwareId, gatewayId: dto.gatewayId },
      },
    });

    // Return plain password only once — not stored
    return { device, mqttUsername, mqttPassword };
  }

  async findAll(gatewayId?: string) {
    return this.prisma.device.findMany({
      where: gatewayId ? { gatewayId } : undefined,
      include: { desk: { select: { name: true, code: true } } },
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

  async heartbeat(hardwareId: string, rssi?: number) {
    return this.prisma.device.update({
      where: { hardwareId },
      data: { isOnline: true, lastSeen: new Date(), rssi },
    });
  }

  async updateFirmwareVersion(hardwareId: string, version: string) {
    return this.prisma.device.update({
      where: { hardwareId },
      data: { firmwareVersion: version },
    });
  }

  async markOffline(hardwareId: string) {
    return this.prisma.device.update({
      where: { hardwareId },
      data: { isOnline: false },
    });
  }

  async assignToDesk(id: string, deskId: string) {
    await this.findOne(id);
    return this.prisma.device.update({ where: { id }, data: { deskId } });
  }

  // Returns command payload — actual MQTT publish is done by MqttService
  buildCommand(command: 'SET_LED' | 'REBOOT' | 'IDENTIFY', params?: object) {
    return { command, params, ts: Date.now() };
  }

  async remove(id: string) {
    await this.prisma.device.delete({ where: { id } });
    return { deleted: true };
  }
}
