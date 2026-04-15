import { Test, TestingModule }            from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationsService }             from './reservations.service';
import { PrismaService }                   from '../../database/prisma.service';
import { LedEventsService }                from '../../shared/led-events.service';
import { GatewaysService }                 from '../gateways/gateways.service';
import { NotificationsService }            from '../notifications/notifications.service';
import { ReservationStatus }               from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────
const TODAY = '2025-06-15';

/** Zwraca ISO string dla today + godziny HH:MM */
function ts(hhmm: string): string {
  return `${TODAY}T${hhmm}:00.000Z`;
}

/** Minimalny mock biurka z lokalizacją */
function makeDeskMock(overrides: Record<string, any> = {}) {
  return {
    id: 'desk-1',
    status: 'ACTIVE',
    location: {
      openTime:       '08:00',
      closeTime:      '18:00',
      maxDaysAhead:   14,
      maxHoursPerDay: 8,
      timezone:       'Europe/Warsaw',
      organizationId: 'org-1',
    },
    ...overrides,
  };
}

/** Minimalny DTO rezerwacji w godzinach pracy */
function makeDto(overrides: Record<string, any> = {}) {
  return {
    deskId:    'desk-1',
    date:      TODAY,
    startTime: ts('09:00'),
    endTime:   ts('11:00'),
    notes:     null,
    ...overrides,
  };
}

// ── Mocki serwisów ────────────────────────────────────────────
const prismaMock = {
  desk: {
    findUnique: jest.fn(),
  },
  reservation: {
    findFirst:   jest.fn(),
    findUnique:  jest.fn(),
    findMany:    jest.fn(),
    create:      jest.fn(),
    update:      jest.fn(),
    updateMany:  jest.fn(),
  },
  checkin: {
    updateMany: jest.fn(),
  },
  event: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const ledEventsMock  = { emit: jest.fn() };
const gatewaysMock   = { findGatewayForDesk: jest.fn(), sendBeaconCommand: jest.fn() };
const notifyMock     = {
  notifyReservationConfirmed:  jest.fn(),
  notifyReservationCancelled:  jest.fn(),
};

// ── Test suite ────────────────────────────────────────────────
describe('ReservationsService', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService,        useValue: prismaMock       },
        { provide: LedEventsService,     useValue: ledEventsMock    },
        { provide: GatewaysService,      useValue: gatewaysMock     },
        { provide: NotificationsService, useValue: notifyMock       },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  // ══════════════════════════════════════════════════════════
  // create() — walidacje
  // ══════════════════════════════════════════════════════════
  describe('create()', () => {

    it('rzuca NotFoundException gdy biurko nie istnieje', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', makeDto()))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('rzuca ConflictException gdy endTime <= startTime', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());

      const dto = makeDto({
        startTime: ts('11:00'),
        endTime:   ts('09:00'), // wcześniej niż start
      });

      await expect(service.create('user-1', dto))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy czas trwania > maxHoursPerDay', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());

      const dto = makeDto({
        startTime: ts('08:00'),
        endTime:   ts('17:01'), // 9h 1min > 8h limit
      });

      await expect(service.create('user-1', dto))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy rezerwacja przed otwarciem biura', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());

      const dto = makeDto({
        startTime: ts('06:00'), // < openTime 08:00
        endTime:   ts('10:00'),
      });

      await expect(service.create('user-1', dto))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy rezerwacja po zamknięciu biura', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());

      const dto = makeDto({
        startTime: ts('16:00'),
        endTime:   ts('19:00'), // > closeTime 18:00
      });

      await expect(service.create('user-1', dto))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy nakładające się godziny (CONFIRMED)', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      prismaMock.reservation.findFirst.mockResolvedValue({
        id: 'existing-res',
        status: ReservationStatus.CONFIRMED,
      });

      await expect(service.create('user-1', makeDto()))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy nakładające się godziny (PENDING)', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      prismaMock.reservation.findFirst.mockResolvedValue({
        id: 'existing-res',
        status: ReservationStatus.PENDING,
      });

      await expect(service.create('user-1', makeDto()))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('NIE rzuca błędu gdy nakładający się slot ma status EXPIRED', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      // findFirst z where status in [PENDING, CONFIRMED] — brak konfliktu
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.reservation.create.mockResolvedValue({
        id: 'new-res',
        deskId: 'desk-1',
        userId: 'user-1',
        startTime: new Date(ts('09:00')),
        endTime:   new Date(ts('11:00')),
        status: ReservationStatus.CONFIRMED,
        desk: { name: 'A01', code: 'A01' },
      });

      const result = await service.create('user-1', makeDto());
      expect(result.id).toBe('new-res');
    });

    it('NIE rzuca błędu gdy nakładający się slot ma status CANCELLED', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.reservation.create.mockResolvedValue({
        id: 'new-res-2',
        deskId: 'desk-1',
        userId: 'user-1',
        startTime: new Date(ts('09:00')),
        endTime:   new Date(ts('11:00')),
        status: ReservationStatus.CONFIRMED,
        desk: { name: 'A01', code: 'A01' },
      });

      const result = await service.create('user-1', makeDto());
      expect(result.id).toBe('new-res-2');
    });

    it('tworzy rezerwację z userId targetUserId gdy podany', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.reservation.create.mockResolvedValue({
        id: 'res-for-other',
        deskId:    'desk-1',
        userId:    'target-user',
        startTime: new Date(ts('09:00')),
        endTime:   new Date(ts('11:00')),
        status:    ReservationStatus.CONFIRMED,
        desk:      { name: 'A01', code: 'A01' },
      });

      const dto = makeDto({ targetUserId: 'target-user' });
      await service.create('admin-user', dto);

      // Sprawdź że prisma.reservation.create dostała userId: 'target-user'
      const createCall = prismaMock.reservation.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('target-user');
    });

    it('wysyła powiadomienie email po pomyślnym create', async () => {
      prismaMock.desk.findUnique.mockResolvedValue(makeDeskMock());
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.reservation.create.mockResolvedValue({
        id: 'res-notify',
        deskId: 'desk-1',
        userId: 'user-1',
        startTime: new Date(ts('09:00')),
        endTime:   new Date(ts('11:00')),
        status: ReservationStatus.CONFIRMED,
        desk: { name: 'A01', code: 'A01' },
      });

      await service.create('user-1', makeDto());

      // notifyReservationConfirmed powinno być wywołane (async catch)
      await Promise.resolve(); // flush microtasks
      expect(notifyMock.notifyReservationConfirmed).toHaveBeenCalledWith('res-notify');
    });
  });

  // ══════════════════════════════════════════════════════════
  // cancel()
  // ══════════════════════════════════════════════════════════
  describe('cancel()', () => {
    const existingReservation = {
      id:       'res-1',
      userId:   'user-1',
      deskId:   'desk-1',
      status:   ReservationStatus.CONFIRMED,
      qrToken:  'qr-abc',
    };

    beforeEach(() => {
      prismaMock.reservation.findUnique.mockResolvedValue(existingReservation);
      prismaMock.reservation.update.mockResolvedValue({
        ...existingReservation,
        status: ReservationStatus.CANCELLED,
      });
      prismaMock.checkin.updateMany.mockResolvedValue({ count: 0 });
    });

    it('właściciel może anulować własną rezerwację', async () => {
      const result = await service.cancel('res-1', 'user-1', 'END_USER');
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });

    it('SUPER_ADMIN może anulować cudzą rezerwację', async () => {
      const result = await service.cancel('res-1', 'other-user', 'SUPER_ADMIN');
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });

    it('OFFICE_ADMIN może anulować cudzą rezerwację', async () => {
      const result = await service.cancel('res-1', 'other-user', 'OFFICE_ADMIN');
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });

    it('rzuca ForbiddenException gdy inny END_USER próbuje anulować', async () => {
      await expect(service.cancel('res-1', 'other-user', 'END_USER'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca ForbiddenException gdy STAFF próbuje anulować cudzą rezerwację', async () => {
      await expect(service.cancel('res-1', 'other-user', 'STAFF'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca ConflictException gdy rezerwacja już CANCELLED', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue({
        ...existingReservation,
        status: ReservationStatus.CANCELLED,
      });

      await expect(service.cancel('res-1', 'user-1', 'END_USER'))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca ConflictException gdy rezerwacja już COMPLETED', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue({
        ...existingReservation,
        status: ReservationStatus.COMPLETED,
      });

      await expect(service.cancel('res-1', 'user-1', 'END_USER'))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('emituje LED FREE po anulowaniu', async () => {
      await service.cancel('res-1', 'user-1', 'END_USER');
      expect(ledEventsMock.emit).toHaveBeenCalledWith('desk-1', 'FREE');
    });

    it('wysyła powiadomienie email o anulowaniu', async () => {
      await service.cancel('res-1', 'user-1', 'END_USER');
      await Promise.resolve();
      expect(notifyMock.notifyReservationCancelled).toHaveBeenCalledWith('res-1');
    });
  });

  // ══════════════════════════════════════════════════════════
  // expireOld() — cron co 15 min
  // ══════════════════════════════════════════════════════════
  describe('expireOld()', () => {
    it('aktualizuje tylko CONFIRMED rezerwacje z endTime < now', async () => {
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.expireOld();

      const callArgs = prismaMock.reservation.updateMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe(ReservationStatus.CONFIRMED);
      expect(callArgs.where.endTime.lt).toBeInstanceOf(Date);
      expect(callArgs.data.status).toBe(ReservationStatus.EXPIRED);
      expect(count).toBe(3);
    });

    it('zwraca 0 gdy nie ma przeterminowanych rezerwacji', async () => {
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 0 });

      const count = await service.expireOld();
      expect(count).toBe(0);
    });

    it('NIE ustawia EXPIRED dla PENDING rezerwacji', async () => {
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 0 });
      await service.expireOld();

      const callArgs = prismaMock.reservation.updateMany.mock.calls[0][0];
      // where.status musi być tylko CONFIRMED, nie PENDING
      expect(callArgs.where.status).toBe(ReservationStatus.CONFIRMED);
      expect(callArgs.where.status).not.toEqual({ in: expect.anything() });
    });
  });
});
