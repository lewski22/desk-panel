import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import {
  ownerOrgsTotal, ownerGatewaysTotal, ownerBeaconsTotal,
  ownerBeaconsFwOutdated, ownerProvisioningErrors,
  clientDesksTotal, clientDesksOccupied, clientReservationsToday,
  clientBeaconRssi, clientBeaconLastSeen,
  clientGatewayLastSeen, clientGatewayVersionInfo,
  dbQueryDuration, dbErrorsTotal,
} from './metrics.registry';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Pierwsze zasilenie metryk przy starcie (bez czekania na cron)
    this._collectOwnerMetrics().catch(() => {});
    this._collectClientMetrics().catch(() => {});
    this._registerPrismaMiddleware();
  }

  // ── Prisma $extends — mierzy każde zapytanie DB (Prisma 7) ────────────
  // Prisma 7 usunęło $use middleware — używamy $extends z query interceptor.
  // $extends zwraca nowy klient — reassignujemy przez Object.assign żeby
  // zachować kompatybilność z wstrzykniętym PrismaService.
  private _registerPrismaMiddleware() {
    const extended = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const start = Date.now();
            try {
              const result = await query(args);
              dbQueryDuration.observe(
                { model: model ?? 'unknown', operation },
                (Date.now() - start) / 1000,
              );
              return result;
            } catch (err) {
              dbQueryDuration.observe(
                { model: model ?? 'unknown', operation },
                (Date.now() - start) / 1000,
              );
              dbErrorsTotal.inc({ model: model ?? 'unknown', operation });
              throw err;
            }
          },
        },
      },
    });
    // Przenieś rozszerzone metody query na ten serwis (zachowaj referencję)
    Object.assign(this.prisma, extended);
  }

  // ── Owner — globalne agregaty (co 30s) ───────────────────────

  @Cron('*/30 * * * * *')
  async _collectOwnerMetrics() {
    try {
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
      ownerOrgsTotal.set({ status: 'inactive' },  inactiveOrgs);
      ownerGatewaysTotal.set({ status: 'online' },  onlineGws);
      ownerGatewaysTotal.set({ status: 'offline' }, offlineGws);
      ownerBeaconsTotal.set({ status: 'online' },   onlineBeacons);
      ownerBeaconsTotal.set({ status: 'offline' },  offlineBeacons);

      // Beacony z nieaktualnym FW (per org)
      // Pobieramy per org — beacon outdated = firmwareVersion nie jest null i nie zgadza się z najnowszą
      // Uproszczone: liczymy beacony które nie wysłały heartbeatu od >10 min (proxy dla outdated)
      const orgs = await this.prisma.organization.findMany({
        where:  { isActive: true },
        select: { id: true },
      });

      for (const org of orgs) {
        // UNAUTHORIZED_SCAN w ostatnich 24h — sygnał problemów z provisioningiem
        const since24h = new Date(Date.now() - 86400_000);
        const [pErrors, outdated] = await Promise.all([
          this.prisma.event.count({
            where: {
              organizationId: org.id,
              type:  'UNAUTHORIZED_SCAN',
              ts:    { gte: since24h },
            },
          }),
          this.prisma.device.count({
            where: {
              // @ts-ignore — organizationId przez location
              location: { organizationId: org.id },
              isOnline: false,
              firmwareVersion: { not: null },
            },
          }),
        ]);
        ownerProvisioningErrors.set({ org_id: org.id }, pErrors);
        ownerBeaconsFwOutdated.set({ org_id: org.id },  outdated);
      }
    } catch (e: any) {
      this.logger.warn(`Owner metrics collection failed: ${e.message}`);
    }
  }

  // ── Client — per org/location (co 60s) ───────────────────────

  @Cron('0 * * * * *')
  async _collectClientMetrics() {
    try {
      const now   = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Pobierz wszystkie lokalizacje z ich org i biurkami
      const locations = await this.prisma.location.findMany({
        select: {
          id:             true,
          organizationId: true,
          desks: {
            select: {
              id:       true,
              status:   true,
              device:   { select: { id: true, isOnline: true, rssi: true, lastSeen: true, firmwareVersion: true } },
              checkins: {
                where:  { checkedOutAt: null },
                select: { id: true },
                take:   1,
              },
            },
          },
        },
      });

      for (const loc of locations) {
        const orgId = loc.organizationId;
        const locId = loc.id;

        let activeDesks   = 0;
        let inactiveDesks = 0;
        let occupiedNow   = 0;

        for (const desk of loc.desks) {
          if (desk.status === 'ACTIVE') activeDesks++;
          else inactiveDesks++;
          if (desk.checkins.length > 0) occupiedNow++;

          // Per-beacon metrics
          if (desk.device) {
            const d = desk.device;
            if (d.rssi != null) {
              clientBeaconRssi.set({ org_id: orgId, location_id: locId, device_id: d.id }, d.rssi);
            }
            if (d.lastSeen) {
              const ageSec = (Date.now() - d.lastSeen.getTime()) / 1000;
              clientBeaconLastSeen.set({ org_id: orgId, location_id: locId, device_id: d.id }, ageSec);
            }
          }
        }

        clientDesksTotal.set({ org_id: orgId, location_id: locId, status: 'active' },   activeDesks);
        clientDesksTotal.set({ org_id: orgId, location_id: locId, status: 'inactive' }, inactiveDesks);
        clientDesksOccupied.set({ org_id: orgId, location_id: locId }, occupiedNow);

        // Rezerwacje dzisiaj per status
        const resByStatus = await this.prisma.reservation.groupBy({
          by:    ['status'],
          where: { desk: { locationId: locId }, startTime: { gte: today } },
          _count: true,
        });
        for (const r of resByStatus) {
          clientReservationsToday.set(
            { org_id: orgId, location_id: locId, status: r.status },
            r._count,
          );
        }
      }

      // Gateway last seen + version info
      const gateways = await this.prisma.gateway.findMany({
        select: { id: true, locationId: true, isOnline: true, lastSeen: true, version: true,
                  location: { select: { organizationId: true } } },
      });

      for (const gw of gateways) {
        const orgId = gw.location?.organizationId ?? 'unknown';
        if (gw.lastSeen) {
          const ageSec = (Date.now() - gw.lastSeen.getTime()) / 1000;
          clientGatewayLastSeen.set({ org_id: orgId, gateway_id: gw.id }, ageSec);
        }
        if (gw.version) {
          clientGatewayVersionInfo.set({ org_id: orgId, gateway_id: gw.id, version: gw.version }, 1);
        }
      }

    } catch (e: any) {
      this.logger.warn(`Client metrics collection failed: ${e.message}`);
    }
  }

  /**
   * Wywoływane przez CheckinsService przy każdym check-inie.
   * Inkrementuje counter w czasie rzeczywistym (nie czeka na cron).
   */
  incrementCheckin(orgId: string, locationId: string, method: string) {
    // import dynamicznie żeby uniknąć circular dep
    const { clientCheckinsTotal } = require('./metrics.registry');
    clientCheckinsTotal.inc({ org_id: orgId, location_id: locationId, method });
  }

  incrementCheckout(orgId: string, locationId: string) {
    const { clientCheckoutsTotal } = require('./metrics.registry');
    clientCheckoutsTotal.inc({ org_id: orgId, location_id: locationId });
  }

  incrementUnauthorizedScan(orgId: string, gatewayId: string) {
    const { clientUnauthorizedScans } = require('./metrics.registry');
    clientUnauthorizedScans.inc({ org_id: orgId, gateway_id: gatewayId });
  }

  incrementMqttReceived(topicType: string) {
    const { mqttMessagesReceived } = require('./metrics.registry');
    mqttMessagesReceived.inc({ topic_type: topicType });
  }

  incrementMqttPublished(topicType: string) {
    const { mqttMessagesPublished } = require('./metrics.registry');
    mqttMessagesPublished.inc({ topic_type: topicType });
  }
}
