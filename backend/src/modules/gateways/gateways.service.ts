import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { EventType } from '@prisma/client';

@Injectable()
export class GatewaysService {
  private readonly logger = new Logger(GatewaysService.name);
  constructor(
    private prisma:  PrismaService,
    private config:  ConfigService,
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
    const valid = await bcrypt.compare(secret, gw.secretHash);
    if (!valid) throw new UnauthorizedException('Invalid gateway secret');
    await this.prisma.gateway.update({
      where: { id: gatewayId },
      data:  { isOnline: true, lastSeen: new Date() },
    });
    return gw;
  }

  async findAll(locationId?: string) {
    return this.prisma.gateway.findMany({
      where: locationId ? { locationId } : undefined,
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

    return { gatewayId, syncedAt: new Date(), reservations };
  }

  async heartbeat(gatewayId: string, ipAddress?: string) {
    return this.prisma.gateway.update({
      where: { id: gatewayId },
      data:  { isOnline: true, lastSeen: new Date(), ...(ipAddress && { ipAddress }) },
    });
  }

  async deviceHeartbeat(hardwareId: string, rssi?: number, firmwareVersion?: string, isOnline?: boolean) {
    const online = isOnline === false ? false : true;
    return this.prisma.device.update({
      where: { hardwareId },
      data: {
        isOnline:        online,
        lastSeen:        new Date(),
        ...(rssi !== undefined && { rssi }),
        ...(firmwareVersion    && { firmwareVersion }),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.gateway.delete({ where: { id } });
    return { deleted: true };
  }

  async regenerateSecret(id: string) {
    const gw = await this.prisma.gateway.findUnique({ where: { id } });
    if (!gw) throw new NotFoundException('Gateway not found');

    const secret     = randomBytes(24).toString('hex');
    const secretHash = await bcrypt.hash(secret, 10);

    const updated = await this.prisma.gateway.update({
      where:  { id },
      data:   { secretHash },
      select: { id: true, name: true, isOnline: true, lastSeen: true, ipAddress: true },
    });

    return { gateway: updated, secret, secretPreview: secret.slice(0, 8) + '…' };
  }

  /**
   * Wyślij komendę do beacona przez gateway HTTP API → lokalny Mosquitto → beacon.
   * Jedyna poprawna droga — backend i Pi mają osobne brokery Mosquitto.
   */
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
