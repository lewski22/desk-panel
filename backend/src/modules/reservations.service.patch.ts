// ═══════════════════════════════════════════════════════════════════════════
// PATCH 4A — backend/src/modules/reservations/reservations.service.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// ZMIANA 1: Import IntegrationEventService
// ─────────────────────────────────────────
// Dodaj na górze pliku (obok istniejących importów):
//
import { IntegrationEventService } from '../integrations/integration-event.service';
//
// ZMIANA 2: Konstruktor — dodaj parametr
// ─────────────────────────────────────────
// Obecny konstruktor:
//   constructor(
//     private prisma:    PrismaService,
//     private ledEvents: LedEventsService,
//     private gateways:  GatewaysService,
//     private notify:    NotificationsService,
//   ) {}
//
// Nowy konstruktor (dodaj ostatni parametr):
//   constructor(
//     private prisma:             PrismaService,
//     private ledEvents:          LedEventsService,
//     private gateways:           GatewaysService,
//     private notify:             NotificationsService,
//     private integrationEvents:  IntegrationEventService,  // ← DODAJ
//   ) {}
//
// ZMIANA 3: Metoda create() — po linii z this.notify.notifyReservationConfirmed
// ─────────────────────────────────────────────────────────────────────────────
//
// Znajdź blok (około linia po prisma.reservation.create):
//   this._notifyBeaconReservation(dto.deskId, reservation.startTime, reservation.endTime).catch(() => {});
//   this.notify.notifyReservationConfirmed(reservation.id).catch(() => {});
//
// DODAJ poniżej (przed return reservation):

    // Sprint F — dispatch do integracji (Slack/Teams/Webhook)
    this.integrationEvents.onReservationCreated(actorOrgId ?? '', {
      id:        reservation.id,
      deskName:  reservation.desk?.name ?? '',
      userName:  '', // user data dostępna przez osobne query jeśli potrzeba
      date:      new Date(dto.date).toISOString().slice(0, 10),
      startTime: new Date(dto.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      endTime:   new Date(dto.endTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    }).catch(() => {}); // fire-and-forget — nie blokuje odpowiedzi

//
// ZMIANA 4: Metoda cancel() — po linii z this.notify.notifyReservationCancelled
// ─────────────────────────────────────────────────────────────────────────────
//
// Znajdź blok:
//   this.ledEvents.emit(reservation.deskId, 'FREE');
//   this._notifyBeaconReservation(reservation.deskId, null, null).catch(() => {});
//   this.notify.notifyReservationCancelled(reservation.id).catch(() => {});
//
// DODAJ poniżej:

    // Sprint F — dispatch anulowania
    this.integrationEvents.onReservationCancelled(actorOrgId ?? '', {
      id:       id,
      deskName: reservation.desk?.name ?? reservation.deskId,
    }).catch(() => {});

//
// ZMIANA 5: ReservationsModule — dodaj IntegrationsModule do imports
// ─────────────────────────────────────────────────────────────────────────────
// backend/src/modules/reservations/reservations.module.ts
//
// Jeśli plik nie importuje IntegrationsModule:
//   import { IntegrationsModule } from '../integrations/integrations.module';
//   @Module({ imports: [IntegrationsModule, ...], providers: [ReservationsService], ... })
//
// Jeśli IntegrationsModule jest już @Global() — wystarczy dodać IntegrationEventService
// do providers[] LUB skorzystać z globalnego zakresu (żaden dodatkowy import nie potrzebny).
// IntegrationsModule jest @Global() więc IntegrationEventService jest dostępny wszędzie.
