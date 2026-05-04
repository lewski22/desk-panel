/**
 * OwnerHealthService — globalny monitoring infrastruktury dla roli OWNER.
 *
 * Dostarcza agregatywny widok stanu wszystkich bramek i beaconów w systemie
 * bez filtrowania per organizacja. Używany przez panel właściciela platformy
 * do szybkiej oceny zdrowia całej infrastruktury IoT.
 *
 * backend/src/modules/owner/owner-health.service.ts
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type HealthStatus = 'healthy' | 'stale' | 'offline';

@Injectable()
export class OwnerHealthService {
  constructor(private prisma: PrismaService) {}

  // ── Globalny stan infrastruktury ─────────────────────────────
  async getGlobalHealth(filter?: { status?: string; orgId?: string }) {
    const orgs = await this.prisma.organization.findMany({
      where: {
        isActive: true,
        ...(filter?.orgId && { id: filter.orgId }),
      },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      orgs.map(org => this._getOrgHealthData(org.id, org))
    );

    // Filtr po statusie
    if (filter?.status && filter.status !== 'all') {
      return results.filter(r => {
        const s = this._worstStatus(r.gateways.map((g: any) => g.status));
        if (filter.status === 'critical') return s === 'offline';
        if (filter.status === 'problem')  return s === 'stale';
        if (filter.status === 'healthy')  return s === 'healthy';
        return true;
      });
    }

    return results;
  }

  // ── Stan jednej firmy ─────────────────────────────────────────
  async getOrgHealth(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where:  { id: orgId },
      select: { id: true, name: true, slug: true },
    });
    return this._getOrgHealthData(orgId, org);
  }

  // ── Prywatne ─────────────────────────────────────────────────
  private async _getOrgHealthData(orgId: string, org: { id: string; name: string; slug: string }) {
    const locations = await this.prisma.location.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, name: true,
        gateways: {
          select: {
            id: true, name: true, isOnline: true, lastSeen: true, ipAddress: true,
            _count: { select: { devices: true } },
          },
        },
        desks: {
          select: {
            device: {
              select: { id: true, hardwareId: true, isOnline: true, lastSeen: true, rssi: true, firmwareVersion: true },
            },
          },
        },
      },
    });

    const gateways = locations.flatMap(loc =>
      loc.gateways.map(gw => ({
        ...gw,
        locationName: loc.name,
        status: this._gatewayStatus(gw),
      }))
    );

    const beacons = locations.flatMap(loc =>
      loc.desks
        .filter(d => d.device)
        .map(d => ({
          ...d.device!,
          locationName: loc.name,
          status: this._beaconStatus(d.device!),
        }))
    );

    const overallStatus = this._worstStatus(gateways.map(g => g.status));

    return {
      org: { id: org.id, name: org.name, slug: org.slug },
      status: overallStatus,
      gateways,
      beacons,
      summary: {
        gatewaysTotal:  gateways.length,
        gatewaysOnline: gateways.filter(g => g.status === 'healthy').length,
        beaconsTotal:   beacons.length,
        beaconsOnline:  beacons.filter(b => b.status === 'healthy').length,
      },
    };
  }

  private _gatewayStatus(gw: { isOnline: boolean; lastSeen: Date | null }): HealthStatus {
    if (!gw.isOnline) return 'offline';
    if (!gw.lastSeen) return 'offline';
    const minutesAgo = (Date.now() - new Date(gw.lastSeen).getTime()) / 60_000;
    if (minutesAgo > 5) return 'stale';
    return 'healthy';
  }

  private _beaconStatus(d: { isOnline: boolean; lastSeen: Date | null }): HealthStatus {
    if (!d.isOnline) return 'offline';
    if (!d.lastSeen) return 'offline';
    const minutesAgo = (Date.now() - new Date(d.lastSeen).getTime()) / 60_000;
    if (minutesAgo > 10) return 'stale';
    return 'healthy';
  }

  private _worstStatus(statuses: HealthStatus[]): HealthStatus {
    if (!statuses.length)               return 'offline';
    if (statuses.some(s => s === 'offline')) return 'offline';
    if (statuses.some(s => s === 'stale'))   return 'stale';
    return 'healthy';
  }
}
