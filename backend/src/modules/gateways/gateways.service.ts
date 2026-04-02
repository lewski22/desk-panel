import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { EventType } from '@prisma/client';

@Injectable()
export class GatewaysService {
  constructor(private prisma: PrismaService) {}

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

  async deviceHeartbeat(hardwareId: string, rssi?: number, firmwareVersion?: string) {
    return this.prisma.device.update({
      where: { hardwareId },
      data: {
        isOnline:        true,
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
}
