import { Test, TestingModule }            from '@nestjs/testing';
import {
  ConflictException, ForbiddenException, NotFoundException, BadRequestException,
}                                          from '@nestjs/common';
import { CheckinsService }                 from './checkins.service';
import { PrismaService }                   from '../../database/prisma.service';
import { LedEventsService }                from '../../shared/led-events.service';
import { NfcScanService }                  from '../../shared/nfc-scan.service';
import { ReservationStatus, CheckinMethod, EventType } from '@prisma/client';

// ── Mocki ─────────────────────────────────────────────────────
const prismaMock = {
  user:        { findUnique: jest.fn() },
  desk:        { findUnique: jest.fn() },
  reservation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  checkin:     { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
  event:       { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn(),
};

const ledEventsMock = { emit: jest.fn() };
const nfcScanMock   = { notifyScan: jest.fn() };

// ── Fixtures ──────────────────────────────────────────────────
const NOW       = new Date('2025-06-15T10:00:00Z');
const USER_ID   = 'user-1';
const DESK_ID   = 'desk-1';
const CARD_UID  = 'AA:BB:CC:DD';
const RES_ID    = 'res-1';
const QR_TOKEN  = 'qr-abc123';

const makeUser = (overrides: Record<string, any> = {}) => ({
  id:       USER_ID,
  isActive: true,
  ...overrides,
});

const makeReservation = (overrides: Record<string, any> = {}) => ({
  id:        RES_ID,
  deskId:    DESK_ID,
  userId:    USER_ID,
  status:    ReservationStatus.CONFIRMED,
  startTime: new Date('2025-06-15T09:00:00Z'),
  endTime:   new Date('2025-06-15T12:00:00Z'),
  qrToken:   QR_TOKEN,
  ...overrides,
});

const makeCheckin = (overrides: Record<string, any> = {}) => ({
  id:           'ci-1',
  reservationId: RES_ID,
  deskId:        DESK_ID,
  userId:        USER_ID,
  method:        CheckinMethod.NFC,
  checkedInAt:   NOW,
  checkedOutAt:  null,
  ...overrides,
});

const makeDesk = (overrides: Record<string, any> = {}) => ({
  id:     DESK_ID,
  name:   'A-01',
  status: 'ACTIVE',
  location: {
    openTime:   '08:00',
    closeTime:  '20:00',
    timezone:   'Europe/Warsaw',
    organizationId: 'org-1',
  },
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────
describe('CheckinsService', () => {
  let service: CheckinsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinsService,
        { provide: PrismaService,    useValue: prismaMock   },
        { provide: LedEventsService, useValue: ledEventsMock },
        { provide: NfcScanService,   useValue: nfcScanMock  },
      ],
    }).compile();

    service = module.get<CheckinsService>(CheckinsService);
  });

  // ══════════════════════════════════════════════════════════
  // nfcCheckin() — weryfikacja karty NFC
  // ══════════════════════════════════════════════════════════
  describe('nfcCheckin()', () => {

    it('zwraca authorized=false gdy karta nie jest zarejestrowana', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.checkinNfc(DESK_ID, CARD_UID, 'gateway-1');

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('card_not_registered');
    });

    it('zwraca authorized=false gdy użytkownik nieaktywny', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

      const result = await service.checkinNfc(DESK_ID, CARD_UID, 'gateway-1');

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('card_not_registered');
    });

    it('zwraca authorized=false gdy brak aktywnej rezerwacji', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      prismaMock.reservation.findFirst.mockResolvedValue(null);

      const result = await service.checkinNfc(DESK_ID, CARD_UID, 'gateway-1');

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('no_active_reservation');
    });

    it('zwraca alreadyCheckedIn=true gdy check-in już istnieje', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      prismaMock.reservation.findFirst.mockResolvedValue(makeReservation());
      prismaMock.checkin.findUnique.mockResolvedValue(makeCheckin());

      const result = await service.checkinNfc(DESK_ID, CARD_UID, 'gateway-1');

      expect(result.authorized).toBe(true);
      expect(result.alreadyCheckedIn).toBe(true);
    });

    it('tworzy check-in i emituje OCCUPIED przy pierwszym skanowaniu', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser());
      prismaMock.reservation.findFirst.mockResolvedValue(makeReservation());
      prismaMock.checkin.findUnique.mockResolvedValue(null);
      const newCheckin = makeCheckin();
      prismaMock.$transaction.mockResolvedValue([newCheckin, makeReservation()]);

      const result = await service.checkinNfc(DESK_ID, CARD_UID, 'gateway-1');

      expect(result.authorized).toBe(true);
      expect(result.alreadyCheckedIn).toBeUndefined();
      expect(ledEventsMock.emit).toHaveBeenCalledWith(DESK_ID, 'OCCUPIED');
    });
  });

  // ══════════════════════════════════════════════════════════
  // checkinQr() — check-in przez QR z rezerwacją
  // ══════════════════════════════════════════════════════════
  describe('checkinQr()', () => {

    it('rzuca ForbiddenException gdy QR token nie pasuje do rezerwacji', async () => {
      prismaMock.reservation.findFirst.mockResolvedValue(null);

      await expect(service.checkinQr(USER_ID, DESK_ID, 'wrong-qr'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('zwraca istniejący checkin gdy już się zameldował', async () => {
      prismaMock.reservation.findFirst.mockResolvedValue(makeReservation());
      const existing = makeCheckin();
      prismaMock.checkin.findUnique.mockResolvedValue(existing);

      const result = await service.checkinQr(USER_ID, DESK_ID, QR_TOKEN);

      expect(result.id).toBe('ci-1');
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('tworzy check-in i emituje OCCUPIED', async () => {
      prismaMock.reservation.findFirst.mockResolvedValue(makeReservation());
      prismaMock.checkin.findUnique.mockResolvedValue(null);
      const newCheckin = makeCheckin({ method: CheckinMethod.QR });
      prismaMock.$transaction.mockResolvedValue([newCheckin, makeReservation()]);

      const result = await service.checkinQr(USER_ID, DESK_ID, QR_TOKEN);

      expect(result.method).toBe(CheckinMethod.QR);
      expect(ledEventsMock.emit).toHaveBeenCalledWith(DESK_ID, 'OCCUPIED');
    });
  });

  // ══════════════════════════════════════════════════════════
  // walkinQr() — walk-in bez rezerwacji
  // ══════════════════════════════════════════════════════════
  describe('walkinQr()', () => {

    it('rzuca NotFoundException gdy biurko nieaktywne', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(null);

      await expect(service.walkinQr(USER_ID, DESK_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('rzuca NotFoundException gdy biurko ma status INACTIVE', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDesk({ status: 'INACTIVE' }));

      await expect(service.walkinQr(USER_ID, DESK_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('rzuca ConflictException gdy biurko zajęte przez innego użytkownika', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDesk());
      // Active checkin innego usera
      prismaMock.checkin.findFirst
        .mockResolvedValueOnce({ id: 'ci-other', userId: 'other-user' }) // activeCheckin
        .mockResolvedValueOnce(null); // ownActive

      await expect(service.walkinQr(USER_ID, DESK_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('zwraca istniejący walkin gdy ten sam user już jest zameldowany', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDesk());
      const ownCheckin = makeCheckin({ userId: USER_ID, reservation: makeReservation() });
      prismaMock.checkin.findFirst
        .mockResolvedValueOnce(ownCheckin) // activeCheckin (sam user)
        .mockResolvedValueOnce(ownCheckin); // ownActive

      const result = await service.walkinQr(USER_ID, DESK_ID);
      expect(result.checkin.id).toBe('ci-1');
    });

    it('tworzy rezerwację walk-in i checkin gdy biurko wolne', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDesk());
      prismaMock.checkin.findFirst.mockResolvedValue(null);
      prismaMock.reservation.findFirst.mockResolvedValue(null);

      const newRes = makeReservation({ id: 'walkin-res' });
      const newCheckin = makeCheckin({ id: 'walkin-ci', reservationId: 'walkin-res' });
      prismaMock.$transaction.mockResolvedValue([newRes, newCheckin]);

      await service.walkinQr(USER_ID, DESK_ID);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(ledEventsMock.emit).toHaveBeenCalledWith(DESK_ID, 'OCCUPIED');
    });
  });

  // ══════════════════════════════════════════════════════════
  // checkout()
  // ══════════════════════════════════════════════════════════
  describe('checkout()', () => {

    it('rzuca NotFoundException gdy checkin nie istnieje', async () => {
      prismaMock.checkin.findUnique.mockResolvedValue(null);

      await expect(service.checkout(RES_ID, USER_ID, 'END_USER'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('rzuca ConflictException gdy już checkout', async () => {
      prismaMock.checkin.findUnique.mockResolvedValue(
        makeCheckin({ checkedOutAt: new Date() })
      );

      await expect(service.checkout(RES_ID, USER_ID, 'END_USER'))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ForbiddenException gdy inny END_USER próbuje checkout', async () => {
      prismaMock.checkin.findUnique.mockResolvedValue(makeCheckin({ userId: 'other-user' }));

      await expect(service.checkout(RES_ID, USER_ID, 'END_USER'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('pozwala OFFICE_ADMIN na checkout cudzego check-in', async () => {
      prismaMock.checkin.findUnique.mockResolvedValue(makeCheckin({ userId: 'other-user' }));
      prismaMock.checkin.update.mockResolvedValue(makeCheckin({ checkedOutAt: NOW }));

      const result = await service.checkout(RES_ID, USER_ID, 'OFFICE_ADMIN');
      expect(result.checkedOutAt).toBeInstanceOf(Date);
    });

    it('emituje LED FREE po checkout', async () => {
      prismaMock.checkin.findUnique.mockResolvedValue(makeCheckin());
      prismaMock.checkin.update.mockResolvedValue(makeCheckin({ checkedOutAt: NOW }));

      await service.checkout(RES_ID, USER_ID, 'END_USER');
      expect(ledEventsMock.emit).toHaveBeenCalledWith(DESK_ID, 'FREE');
    });
  });

  // ══════════════════════════════════════════════════════════
  // autoCheckout() — cron co 15 min
  // ══════════════════════════════════════════════════════════
  describe('autoCheckout()', () => {

    it('zamyka checkins z wygasłą rezerwacją', async () => {
      const expiredCheckin = makeCheckin();
      prismaMock.checkin.findMany
        .mockResolvedValueOnce([expiredCheckin]) // expiredCheckins
        .mockResolvedValueOnce([]);              // staleCheckins
      prismaMock.checkin.updateMany.mockResolvedValue({ count: 1 });

      await service.autoCheckout();

      expect(prismaMock.checkin.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [expiredCheckin.id] } },
          data:  { checkedOutAt: expect.any(Date) },
        })
      );
    });

    it('zamyka stale walk-in checkins starsze niż 12h', async () => {
      const staleCheckin = { ...makeCheckin(), reservationId: null };
      prismaMock.checkin.findMany
        .mockResolvedValueOnce([])           // expiredCheckins
        .mockResolvedValueOnce([staleCheckin]); // staleCheckins
      prismaMock.checkin.updateMany.mockResolvedValue({ count: 1 });

      await service.autoCheckout();

      const ids = prismaMock.checkin.updateMany.mock.calls[0][0].where.id.in;
      expect(ids).toContain(staleCheckin.id);
    });

    it('emituje LED FREE dla każdego zamkniętego biurka', async () => {
      const c1 = makeCheckin({ id: 'ci-1', deskId: 'desk-1' });
      const c2 = { ...makeCheckin({ id: 'ci-2', deskId: 'desk-2' }) };
      prismaMock.checkin.findMany
        .mockResolvedValueOnce([c1, c2])
        .mockResolvedValueOnce([]);
      prismaMock.checkin.updateMany.mockResolvedValue({ count: 2 });

      await service.autoCheckout();

      expect(ledEventsMock.emit).toHaveBeenCalledWith('desk-1', 'FREE');
      expect(ledEventsMock.emit).toHaveBeenCalledWith('desk-2', 'FREE');
    });

    it('nie robi nic gdy brak przeterminowanych checkinów', async () => {
      prismaMock.checkin.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.autoCheckout();

      expect(prismaMock.checkin.updateMany).not.toHaveBeenCalled();
      expect(ledEventsMock.emit).not.toHaveBeenCalled();
    });
  });
});
