// ═══════════════════════════════════════════════════════════════════════════
// PATCH 4B — backend/src/modules/checkins/checkins.service.ts
// ═══════════════════════════════════════════════════════════════════════════
//
// ZMIANA 1: Import
//   import { IntegrationEventService } from '../integrations/integration-event.service';
//
// ZMIANA 2: Konstruktor — dodaj parametr na końcu:
//   constructor(
//     private prisma:            PrismaService,
//     private ledEvents:         LedEventsService,
//     private nfcScan:           NfcScanService,
//     private integrationEvents: IntegrationEventService,  // ← DODAJ
//   ) {}
//
// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 3: checkinNfc() — po "this.ledEvents.emit(deskId, 'OCCUPIED');"
// ─────────────────────────────────────────────────────────────────────────────
//
// Obecny kod:
//   this.ledEvents.emit(deskId, 'OCCUPIED');
//   return { authorized: true, checkin };
//
// Podmień na:

    this.ledEvents.emit(deskId, 'OCCUPIED');

    // Sprint F — dispatch check-in NFC
    // Potrzebujemy orgId — pobieramy z desk.location (jest już w pamięci z wcześniejszego query)
    // Użyj desk.location.organizationId jeśli masz dostęp, lub pobierz:
    this.prisma.desk.findUnique({
      where:   { id: deskId },
      select:  { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'nfc', {
        deskId,
        deskName:    d.name,
        userId:      user.id,
        userName:    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        locationName: d.location.name,
      });
    }).catch(() => {});

    return { authorized: true, checkin };

// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 4: checkinQr() — po "this.ledEvents.emit(reservation.deskId, 'OCCUPIED');"
// ─────────────────────────────────────────────────────────────────────────────
//
// Znajdź: this.ledEvents.emit(reservation.deskId, 'OCCUPIED');
// DODAJ poniżej (przed return):

    // Sprint F — dispatch check-in QR
    this.prisma.desk.findUnique({
      where:  { id: reservation.deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      this.integrationEvents.onCheckin(d.location.organizationId, 'qr', {
        deskId:      reservation.deskId,
        deskName:    d.name,
        userId,
        locationName: d.location.name,
      });
    }).catch(() => {});

// ─────────────────────────────────────────────────────────────────────────────
// ZMIANA 5: manual() — po "this.ledEvents.emit(deskId, 'OCCUPIED');"
// ─────────────────────────────────────────────────────────────────────────────

    // Sprint F — dispatch check-in manual
    this.prisma.desk.findUnique({
      where:  { id: deskId },
      select: { name: true, location: { select: { organizationId: true, name: true } } },
    }).then(d => {
      if (!d) return;
      // actorOrgId dostępny w closurze
      this.integrationEvents.onCheckin(d.location.organizationId, 'manual', {
        deskId,
        deskName:    d.name,
        userId,
        locationName: d.location.name,
      });
    }).catch(() => {});
