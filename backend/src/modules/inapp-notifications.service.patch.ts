// ═══════════════════════════════════════════════════════════════════════════
// PATCH 4C — backend/src/modules/inapp-notifications/inapp-notifications.service.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// To jest NAJLEPSZE miejsce do beacon/gateway offline — cron scanInfrastructure()
// już pobiera wszystkie potrzebne dane z DB.
//
// ZMIANA 1: Import
//   import { IntegrationEventService } from '../integrations/integration-event.service';
//
// ZMIANA 2: Konstruktor — dodaj parametr:
//   constructor(
//     private prisma:            PrismaService,
//     private integrationEvents: IntegrationEventService,  // ← DODAJ
//   ) {}
//
// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 3: scanInfrastructure() — w pętli for(const gw of offlineGws)
// ─────────────────────────────────────────────────────────────────────────────
//
// Obecny kod w pętli:
//   for (const gw of offlineGws) {
//     const orgId = gw.location?.organization?.id;
//     await this.create({ ... });         // in-app notification (pozostaje)
//   }
//
// DODAJ w pętli, PO istniejącym this.create(...):

    for (const gw of offlineGws) {
      const orgId = gw.location?.organization?.id;

      // Istniejące in-app notification — ZOSTAJE bez zmian
      await this.create({ /* ... istniejący kod ... */ }, `inapp:gw:${gw.id}:offline`, 120);

      // Sprint F — dispatch do Slack/Teams/Webhook (fire-and-forget)
      if (orgId) {
        this.integrationEvents.onGatewayOffline(orgId, {
          gatewayId:    gw.id,
          locationName: gw.location?.name ?? undefined,
        }).catch(() => {});
      }

      // Aktualizuj isOnline w DB — gateway faktycznie offline
      await this.prisma.gateway.update({
        where: { id: gw.id },
        data:  { isOnline: false },
      }).catch(() => {});
    }

// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 4: scanInfrastructure() — w pętli for(const dev of offlineDevices)
// ─────────────────────────────────────────────────────────────────────────────
//
// Obecny kod:
//   for (const dev of offlineDevices) {
//     const orgId = dev.desk?.location?.organization?.id;
//     await this.create({ ... });
//   }
//
// DODAJ w pętli, PO istniejącym this.create(...):

    for (const dev of offlineDevices) {
      const orgId = dev.desk?.location?.organization?.id;

      // Istniejące in-app notification — ZOSTAJE
      await this.create({ /* ... istniejący kod ... */ }, `inapp:beacon:${dev.id}:offline`, 120);

      // Sprint F — dispatch do Slack/Teams/Webhook
      if (orgId) {
        const lastSeenAgo = dev.lastSeen
          ? Math.round((Date.now() - new Date(dev.lastSeen).getTime()) / 1000)
          : undefined;

        this.integrationEvents.onBeaconOffline(orgId, {
          deviceId:    dev.hardwareId,
          deskName:    dev.desk?.name ?? undefined,
          locationName: dev.desk?.location?.name ?? undefined,
          lastSeenAgo,
        }).catch(() => {});
      }

      // Aktualizuj isOnline = false w DB
      await this.prisma.device.update({
        where: { id: dev.id },
        data:  { isOnline: false },
      }).catch(() => {});
    }

// ─────────────────────────────────────────────────────────────────────────────
// UWAGA: InAppNotificationsModule — IntegrationsModule jest @Global()
// Nie musisz dodawać importu do InAppNotificationsModule.
// IntegrationEventService jest automatycznie dostępny przez DI.
// ─────────────────────────────────────────────────────────────────────────────
