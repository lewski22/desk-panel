/**
 * PATCH: backend/src/modules/reservations/reservations.service.ts
 *
 * Kompletny diff — Graph Sync + IntegrationEvents.
 * Stosuj sekcja po sekcji — nie zastępuj całego pliku.
 */

// ── SEKCJA 1: Importy (dodaj do istniejących) ────────────────────────────────
import { GraphService }            from '../graph-sync/graph.service';
import { IntegrationEventService } from '../integrations/integration-event.service';

// ── SEKCJA 2: Konstruktor (podmień istniejący) ───────────────────────────────
constructor(
  private prisma:             PrismaService,
  private ledEvents:          LedEventsService,
  private gateways:           GatewaysService,
  private notify:             NotificationsService,
  private integrationEvents:  IntegrationEventService,  // ← @Global, nie potrzeba importu modułu
  private graphService:       GraphService,              // ← z GraphSyncModule
) {}

// ── SEKCJA 3: create() — pełny blok końca metody ────────────────────────────
// Zastąp obecne fire-and-forget blokami poniżej.
// Wklej to PO prisma.reservation.create() i PRZED return reservation:

    // Powiadomienie email
    this._notifyBeaconReservation(dto.deskId, reservation.startTime, reservation.endTime).catch(() => {});
    this.notify.notifyReservationConfirmed(reservation.id).catch(() => {});

    // Sprint F — Slack/Teams/Webhook
    this.integrationEvents.onReservationCreated(actorOrgId ?? '', {
      id:        reservation.id,
      deskName:  reservation.desk?.name ?? '',
      date:      new Date(dto.date).toISOString().slice(0, 10),
      startTime: new Date(dto.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      endTime:   new Date(dto.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    }).catch(() => {});

    // Sprint F M4 — Microsoft Graph Calendar Sync
    // Tworzymy event w kalendarzu Outlook usera (jeśli ma połączony Graph)
    this.graphService.createCalendarEvent(userId, {
      reservationId: reservation.id,
      subject:       `Biurko: ${reservation.desk?.name ?? dto.deskId}`,
      start:         new Date(dto.startTime),
      end:           new Date(dto.endTime),
      location:      reservation.desk?.name,
      bodyText:      `Rezerwacja biurka zarządzana przez Reserti.`,
    }).then(graphEventId => {
      if (graphEventId) {
        // Zapisz graphEventId — potrzebne do usunięcia eventu przy anulowaniu
        return this.prisma.reservation.update({
          where: { id: reservation.id },
          data:  { graphEventId },
        }).catch(() => {});
      }
    }).catch(() => {}); // fire-and-forget — NIGDY nie blokuje odpowiedzi

    return reservation;

// ── SEKCJA 4: cancel() — pełny blok try {} ──────────────────────────────────
// Zastąp istniejący try {} blok tym:

    try {
      this.ledEvents.emit(reservation.deskId, 'FREE');
      this._notifyBeaconReservation(reservation.deskId, null, null).catch(() => {});
      this.notify.notifyReservationCancelled(reservation.id).catch(() => {});

      // Sprint F — integracje
      this.integrationEvents.onReservationCancelled(actorOrgId ?? '', {
        id:       id,
        deskName: (reservation as any).desk?.name ?? reservation.deskId,
      }).catch(() => {});

      // Sprint F M4 — usuń event z Outlook Calendar (jeśli istnieje)
      if ((reservation as any).graphEventId) {
        this.graphService.deleteCalendarEvent(
          reservation.userId,
          (reservation as any).graphEventId,
        ).catch(() => {});
      }
    } catch (_) { /* ignore LED/notify errors */ }

// ── SEKCJA 5: findOne() — dodaj graphEventId do include ─────────────────────
// UWAGA: graphEventId jest polem skalarnym — Prisma zwraca je automatycznie.
// Nie musisz nic zmieniać w findOne() — pole będzie dostępne po `prisma generate`.
//
// Ale dla pewności sprawdź czy findOne() NIE ma explicite select[] który wyklucza scalary:
//   select: { id: true, status: true, ... }  ← graphEventId może być pominięty
//
// Jeśli findOne() używa include (nie select), jesteś bezpieczny.
// Jeśli używa select z listą pól — dodaj graphEventId: true.
