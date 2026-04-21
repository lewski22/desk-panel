import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import {
  ownerOrgsTotal,
  ownerGatewaysTotal,
  ownerBeaconsTotal,
  ownerBeaconsFwOutdated,
  clientDesksTotal,
  clientDesksOccupied,
  clientReservationsToday,
  clientBeaconRssi,
  clientBeaconLastSeen,
  clientGatewayLastSeen,
  clientGatewayVersionInfo,
} from './metrics.registry';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Owner-level global aggregates (every 30s) ─────────────────
  @Cron(CronExpression.EVERY_30_SECONDS)
  async refreshOwnerMetrics() {
    const [activeOrgs, inactiveOrgs, onlineGws, offlineGws, onlineBeacons, offlineBeacons] =
      await Promise.all([
        this.prisma.organization.count({ where: { isActive: true } }),
        this.prisma.organization.count({ where: { isActive: false } }),
        this.prisma.gateway.count({ where: { isOnline: true } }),
        this.prisma.gateway.count({ where: { isOnline: false } }),
        this.prisma.device.count({ where: { isOnline: true } }),
        this.prisma.device.count({ where: { isOnline: false } }),
      ]);

    ownerOrgsTotal.set({ status: 'active' },   activeOrgs);
    ownerOrgsTotal.set({ status: 'inactive' }, inactiveOrgs);
    ownerGatewaysTotal.set({ status: 'online' },  onlineGws);
    ownerGatewaysTotal.set({ status: 'offline' }, offlineGws);
    ownerBeaconsTotal.set({ status: 'online' },  onlineBeacons);
    ownerBeaconsTotal.set({ status: 'offline' }, offlineBeacons);

    // Per-org firmware outdated count
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    await Promise.all(orgs.map(async org => {
      const outdated = await this.prisma.device.count({
        where: {
          location: { organizationId: org.id },
          firmwareCurrent: false,
        },
      });
      ownerBeaconsFwOutdated.set({ org_id: org.id }, outdated);
    }));
  }

  // ── Client-level per-org/location aggregates (every 60s) ─────
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshDeviceMetrics() {
    const now    = new Date();
    const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const locations = await this.prisma.location.findMany({
      select: { id: true, organizationId: true },
    });

    await Promise.all(locations.map(async loc => {
      const orgId = loc.organizationId;
      const locId = loc.id;

      // ── Desk counts ────────────────────────────────────────────
      const [activeDesks, inactiveDesks, occupied, reservationsConfirmed, reservationsPending] =
        await Promise.all([
          this.prisma.desk.count({ where: { locationId: locId, status: 'ACTIVE' } }),
          this.prisma.desk.count({ where: { locationId: locId, status: { not: 'ACTIVE' } } }),
          this.prisma.checkin.count({ where: { desk: { locationId: locId }, checkedOutAt: null } }),
          this.prisma.reservation.count({
            where: { desk: { locationId: locId }, date: today, status: 'CONFIRMED' },
          }),
          this.prisma.reservation.count({
            where: { desk: { locationId: locId }, date: today, status: 'PENDING' },
          }),
        ]);

      clientDesksTotal.set({ org_id: orgId, location_id: locId, status: 'active' },   activeDesks);
      clientDesksTotal.set({ org_id: orgId, location_id: locId, status: 'inactive' }, inactiveDesks);
      clientDesksOccupied.set({ org_id: orgId, location_id: locId }, occupied);
      clientReservationsToday.set({ org_id: orgId, location_id: locId, status: 'CONFIRMED' }, reservationsConfirmed);
      clientReservationsToday.set({ org_id: orgId, location_id: locId, status: 'PENDING' },   reservationsPending);

      // ── Beacon last seen + RSSI ────────────────────────────────
      const beacons = await this.prisma.device.findMany({
        where:  { locationId: locId },
        select: { id: true, lastSeenAt: true, rssi: true },
      });
      for (const b of beacons) {
        const secAgo = b.lastSeenAt
          ? Math.floor((now.getTime() - b.lastSeenAt.getTime()) / 1000)
          : 99999;
        clientBeaconLastSeen.set({ org_id: orgId, location_id: locId, device_id: b.id }, secAgo);
        if (b.rssi != null) {
          clientBeaconRssi.set({ org_id: orgId, location_id: locId, device_id: b.id }, b.rssi);
        }
      }

      // ── Gateway last seen + version ────────────────────────────
      const gateways = await this.prisma.gateway.findMany({
        where:  { locationId: locId },
        select: { id: true, lastSeenAt: true, softwareVersion: true },
      });
      for (const gw of gateways) {
        const secAgo = gw.lastSeenAt
          ? Math.floor((now.getTime() - gw.lastSeenAt.getTime()) / 1000)
          : 99999;
        clientGatewayLastSeen.set({ org_id: orgId, gateway_id: gw.id }, secAgo);
        if (gw.softwareVersion) {
          clientGatewayVersionInfo.set(
            { org_id: orgId, gateway_id: gw.id, version: gw.softwareVersion },
            1,
          );
        }
      }
    }));
  }
}
