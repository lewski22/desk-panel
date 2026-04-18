// ── PATCH: backend/src/modules/reservations/reservations.service.ts ──────────
//
// Integracja Microsoft Graph Sync — tworzenie/usuwanie eventów Outlook
// przy tworzeniu i anulowaniu rezerwacji.
//
// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 1: Import
//   import { GraphService } from '../graph-sync/graph.service';
//
// ZMIANA 2: Konstruktor
//   constructor(
//     private prisma:             PrismaService,
//     private ledEvents:          LedEventsService,
//     private gateways:           GatewaysService,
//     private notify:             NotificationsService,
//     private integrationEvents:  IntegrationEventService,
//     private graphService:       GraphService,             // ← DODAJ
//   ) {}
//
// ZMIANA 3: Metoda create() — po zapisaniu rezerwacji, po integrationEvents.onReservationCreated
// ─────────────────────────────────────────────────────────────────────────────
//
// DODAJ po istniejących fire-and-forget (notify, integrationEvents):

    // Sprint F M4 — Microsoft Graph Calendar Sync (fire-and-forget)
    this.graphService.createCalendarEvent(userId, {
      reservationId: reservation.id,
      subject:       `Biurko: ${reservation.desk?.name ?? dto.deskId}`,
      start:         new Date(dto.startTime),
      end:           new Date(dto.endTime),
      location:      reservation.desk?.name,
      bodyText:      `Rezerwacja biurka ${reservation.desk?.name ?? ''} zarządzana przez Reserti.`,
    }).then(graphEventId => {
      if (graphEventId) {
        // Zapisz graphEventId w DB — potrzebne do update/delete
        return this.prisma.reservation.update({
          where: { id: reservation.id },
          data:  { graphEventId },
        }).catch(() => {});
      }
    }).catch(() => {}); // fire-and-forget — nie blokuje odpowiedzi

//
// ZMIANA 4: Metoda cancel() — po integrationEvents.onReservationCancelled
// ─────────────────────────────────────────────────────────────────────────────

    // Sprint F M4 — usuń event z kalendarza Outlook
    if (reservation.graphEventId) {
      this.graphService.deleteCalendarEvent(
        reservation.userId,
        reservation.graphEventId,
      ).catch(() => {});
    }

//
// ZMIANA 5: ReservationsModule — dodaj GraphSyncModule do imports
// ─────────────────────────────────────────────────────────────────────────────
// backend/src/modules/reservations/reservations.module.ts
//
// import { GraphSyncModule } from '../graph-sync/graph-sync.module';
//
// @Module({
//   imports:  [GraphSyncModule],  // ← DODAJ
//   ...
// })
//
// UWAGA: GraphService jest dostępny przez GraphSyncModule.exports[].
// IntegrationsModule jest @Global() więc nie musisz go importować.
//
// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 6: app.module.ts — dodaj GraphSyncModule
// ─────────────────────────────────────────────────────────────────────────────
// import { GraphSyncModule } from './modules/graph-sync/graph-sync.module';
//
// @Module({
//   imports: [
//     ...istniejące...,
//     IntegrationsModule,  // ← już jest
//     GraphSyncModule,     // ← DODAJ
//   ],
// })
