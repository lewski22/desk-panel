import { Test, TestingModule } from '@nestjs/testing';
import { CheckinsService } from './checkins.service';
import { PrismaService }    from '../../database/prisma.service';
import { LedEventsService } from '../../shared/led-events.service';
import { NfcScanService }   from '../../shared/nfc-scan.service';
import { CheckinMethod, ReservationStatus } from '@prisma/client';

const mockPrisma = {
  user:        { findUnique: jest.fn() },
  reservation: { findFirst: jest.fn(), update: jest.fn() },
  checkin:     { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  event:       { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn(),
};

const mockLedEvents = { emit: jest.fn() };
const mockNfcScan   = { notifyScan: jest.fn() };

describe('CheckinsService', () => {
  let service: CheckinsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinsService,
        { provide: PrismaService,    useValue: mockPrisma },
        { provide: LedEventsService, useValue: mockLedEvents },
        { provide: NfcScanService,   useValue: mockNfcScan },
      ],
    }).compile();

    service = module.get<CheckinsService>(CheckinsService);
    jest.clearAllMocks();
    mockPrisma.event.create.mockResolvedValue({});
  });

  // ── checkinNfc ────────────────────────────────────────────────

  describe('checkinNfc', () => {
    const deskId    = 'desk-1';
    const cardUid   = 'CARD-ABC';
    const gatewayId = 'gw-1';

    it('returns unauthorized when card is not registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.checkinNfc(deskId, cardUid, gatewayId);

      expect(result).toEqual({ authorized: false, reason: 'card_not_registered' });
      expect(mockNfcScan.notifyScan).toHaveBeenCalledWith(cardUid);
      expect(mockLedEvents.emit).not.toHaveBeenCalled();
    });

    it('returns unauthorized when user has no active reservation in ±15 min window', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', cardUid, isActive: true });
      mockPrisma.reservation.findFirst.mockResolvedValue(null);

      const result = await service.checkinNfc(deskId, cardUid, gatewayId);

      expect(result).toEqual({ authorized: false, reason: 'no_active_reservation' });
      expect(mockLedEvents.emit).not.toHaveBeenCalled();
    });

    it('creates checkin and emits LED OCCUPIED when valid NFC scan', async () => {
      const user        = { id: 'user-1', cardUid, isActive: true };
      const reservation = { id: 'res-1', deskId, userId: user.id, status: ReservationStatus.CONFIRMED };
      const checkin     = {
        id: 'ci-1', reservationId: reservation.id,
        deskId, userId: user.id, method: CheckinMethod.NFC,
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.reservation.findFirst.mockResolvedValue(reservation);
      mockPrisma.checkin.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([checkin, {}]);

      const result = await service.checkinNfc(deskId, cardUid, gatewayId);

      expect(result).toEqual({ authorized: true, checkin });
      expect(mockLedEvents.emit).toHaveBeenCalledWith(deskId, 'OCCUPIED');
    });

    it('returns alreadyCheckedIn when open checkin already exists', async () => {
      const user        = { id: 'user-1', cardUid, isActive: true };
      const reservation = { id: 'res-1' };
      const existing    = { id: 'ci-1', reservationId: 'res-1', checkedOutAt: null };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.reservation.findFirst.mockResolvedValue(reservation);
      mockPrisma.checkin.findUnique.mockResolvedValue(existing);

      const result = await service.checkinNfc(deskId, cardUid, gatewayId);

      expect(result).toEqual({ authorized: true, alreadyCheckedIn: true, checkin: existing });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockLedEvents.emit).not.toHaveBeenCalled();
    });
  });

  // ── autoCheckout ──────────────────────────────────────────────

  describe('autoCheckout', () => {
    it('does nothing when there are no open checkins', async () => {
      mockPrisma.checkin.findMany.mockResolvedValue([]);

      await service.autoCheckout();

      expect(mockPrisma.checkin.updateMany).not.toHaveBeenCalled();
      expect(mockLedEvents.emit).not.toHaveBeenCalled();
    });

    it('closes expired-reservation checkins and emits LED FREE per desk', async () => {
      const expired = [{ id: 'ci-1', deskId: 'desk-1', reservationId: 'res-1' }];
      mockPrisma.checkin.findMany
        .mockResolvedValueOnce(expired)  // expiredCheckins
        .mockResolvedValueOnce([]);      // staleCheckins (walk-in)

      await service.autoCheckout();

      expect(mockPrisma.checkin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['ci-1'] } } }),
      );
      expect(mockLedEvents.emit).toHaveBeenCalledWith('desk-1', 'FREE');
    });

    it('closes stale walk-in checkins (>12h) and emits LED FREE', async () => {
      const stale = [{ id: 'ci-2', deskId: 'desk-2' }];
      mockPrisma.checkin.findMany
        .mockResolvedValueOnce([])     // expiredCheckins
        .mockResolvedValueOnce(stale); // staleCheckins (walk-in)

      await service.autoCheckout();

      expect(mockPrisma.checkin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['ci-2'] } } }),
      );
      expect(mockLedEvents.emit).toHaveBeenCalledWith('desk-2', 'FREE');
    });
  });
});
