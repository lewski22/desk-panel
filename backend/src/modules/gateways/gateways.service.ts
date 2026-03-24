import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { EventType } from '@prisma/client';

@Injectable()
export class GatewaysService {
  constructor(private prisma: PrismaService) {}

  async register(locationId: string, name: string) {
    const secret = Math.random().toString(36).slice(2) + Date.now().toString(36);
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

    return { gateway, secret }; // plain secret returned once
  }

  async authenticate(gatewayId: string, secret: string) {
    const gw = await this.prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gw) throw new NotFoundException('Gateway not found');
    const valid = await bcrypt.compare(secret, gw.secretHash);
    if (!valid) throw new UnauthorizedException('Invalid gateway secret');
    await this.prisma.gateway.update({
      where: { id: gatewayId },
      data: { isOnline: true, lastSeen: new Date() },
    });
    return gw;
  }

  async findAll(locationId?: string) {
    return this.prisma.gateway.findMany({
      where: locationId ? { locationId } : undefined,
      include: {
        _count: { select: { devices: true } },
        location: { select: { name: true } },
      },
    });
  }

  async getSync(gatewayId: string) {
    const gw = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
      include: { location: true },
    });
    if (!gw) throw new NotFoundException('Gateway not found');

    // Return all active reservations for today + tomorrow for this location
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        desk: { locationId: gw.locationId },
        status: { in: ['CONFIRMED', 'PENDING'] },
        date: { gte: today, lt: tomorrow },
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
      data: { isOnline: true, lastSeen: new Date(), ...(ipAddress && { ipAddress }) },
    });
  }
}
