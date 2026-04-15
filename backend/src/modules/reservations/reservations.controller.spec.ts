import { Test, TestingModule }             from '@nestjs/testing';
import { ForbiddenException }              from '@nestjs/common';
import { ReservationsController }          from './reservations.controller';
import { ReservationsService }             from './reservations.service';
import { JwtAuthGuard }                    from '../auth/guards/jwt-auth.guard';
import { RolesGuard }                      from '../auth/guards/roles.guard';

// ── Guard mock — przepuszcza wszystko (autoryzację testujemy przez req.user) ──
const PassGuard = { canActivate: () => true };

// ── Service mock ──────────────────────────────────────────────
const svcMock = {
  findAll:   jest.fn(),
  findOne:   jest.fn(),
  findMy:    jest.fn(),
  getQrToken: jest.fn(),
  create:    jest.fn(),
  cancel:    jest.fn(),
};

// ── Fixtures ──────────────────────────────────────────────────
const makeReq = (role: string, userId = 'user-1') => ({
  user: { id: userId, role, organizationId: 'org-1' },
});

const makeDto = () => ({
  deskId:    'desk-1',
  date:      '2025-06-15',
  startTime: '2025-06-15T09:00:00.000Z',
  endTime:   '2025-06-15T11:00:00.000Z',
});

const makeReservation = (overrides: Record<string, any> = {}) => ({
  id:     'res-1',
  userId: 'user-1',
  deskId: 'desk-1',
  status: 'CONFIRMED',
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────
describe('ReservationsController', () => {
  let controller: ReservationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers:   [{ provide: ReservationsService, useValue: svcMock }],
    })
      .overrideGuard(JwtAuthGuard).useValue(PassGuard)
      .overrideGuard(RolesGuard).useValue(PassGuard)
      .compile();

    controller = module.get<ReservationsController>(ReservationsController);
  });

  // ══════════════════════════════════════════════════════════
  // GET /reservations/my
  // ══════════════════════════════════════════════════════════
  describe('GET /my — findMy()', () => {

    it('wywołuje svc.findMy z id zalogowanego użytkownika', async () => {
      svcMock.findMy.mockResolvedValue([]);
      const req = makeReq('END_USER');

      await controller.findMy(undefined!, undefined!, req);

      expect(svcMock.findMy).toHaveBeenCalledWith('user-1', undefined, 50);
    });

    it('limit domyślny = 50, max = 100', async () => {
      svcMock.findMy.mockResolvedValue([]);

      await controller.findMy(undefined!, '200', makeReq('END_USER'));
      expect(svcMock.findMy).toHaveBeenCalledWith('user-1', undefined, 100);

      jest.clearAllMocks();
      svcMock.findMy.mockResolvedValue([]);

      await controller.findMy(undefined!, '10', makeReq('END_USER'));
      expect(svcMock.findMy).toHaveBeenCalledWith('user-1', undefined, 10);
    });

    it('przekazuje filtr daty gdy podany', async () => {
      svcMock.findMy.mockResolvedValue([]);

      await controller.findMy('2025-06-15', undefined!, makeReq('END_USER'));
      expect(svcMock.findMy).toHaveBeenCalledWith('user-1', '2025-06-15', 50);
    });
  });

  // ══════════════════════════════════════════════════════════
  // GET /reservations
  // ══════════════════════════════════════════════════════════
  describe('GET / — findAll()', () => {

    it('przekazuje filtry do svc.findAll', async () => {
      svcMock.findAll.mockResolvedValue([]);

      await controller.findAll('loc-1', 'desk-1', '2025-06-15', 'CONFIRMED');

      expect(svcMock.findAll).toHaveBeenCalledWith({
        locationId: 'loc-1',
        deskId:     'desk-1',
        date:       '2025-06-15',
        status:     'CONFIRMED',
      });
    });

    it('działa bez filtrów (wszystkie undefined)', async () => {
      svcMock.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(svcMock.findAll).toHaveBeenCalledWith({
        locationId: undefined,
        deskId:     undefined,
        date:       undefined,
        status:     undefined,
      });
    });
  });

  // ══════════════════════════════════════════════════════════
  // GET /reservations/:id/qr
  // ══════════════════════════════════════════════════════════
  describe('GET /:id/qr — getQr()', () => {

    it('wywołuje getQrToken z id rezerwacji i id użytkownika', async () => {
      svcMock.getQrToken.mockResolvedValue({ qrToken: 'qr-abc', deskId: 'desk-1' });

      const result = await controller.getQr('res-1', makeReq('END_USER'));

      expect(svcMock.getQrToken).toHaveBeenCalledWith('res-1', 'user-1');
      expect(result.qrToken).toBe('qr-abc');
    });
  });

  // ══════════════════════════════════════════════════════════
  // POST /reservations
  // ══════════════════════════════════════════════════════════
  describe('POST / — create()', () => {

    it('END_USER może tworzyć rezerwację dla siebie', async () => {
      const res = makeReservation();
      svcMock.create.mockResolvedValue(res);

      const result = await controller.create(makeDto(), makeReq('END_USER'));

      expect(svcMock.create).toHaveBeenCalledWith('user-1', makeDto());
      expect(result.id).toBe('res-1');
    });

    it('przekazuje actorId z tokenu JWT (req.user.id)', async () => {
      svcMock.create.mockResolvedValue(makeReservation());

      await controller.create(makeDto(), makeReq('SUPER_ADMIN', 'admin-id'));

      expect(svcMock.create).toHaveBeenCalledWith('admin-id', expect.any(Object));
    });
  });

  // ══════════════════════════════════════════════════════════
  // DELETE /reservations/:id
  // ══════════════════════════════════════════════════════════
  describe('DELETE /:id — cancel()', () => {

    it('właściciel (END_USER) może anulować własną rezerwację', async () => {
      svcMock.cancel.mockResolvedValue({ ...makeReservation(), status: 'CANCELLED' });

      const result = await controller.cancel('res-1', makeReq('END_USER'));

      expect(svcMock.cancel).toHaveBeenCalledWith('res-1', 'user-1', 'END_USER');
      expect(result.status).toBe('CANCELLED');
    });

    it('OFFICE_ADMIN może anulować cudzą rezerwację', async () => {
      svcMock.cancel.mockResolvedValue({ ...makeReservation(), status: 'CANCELLED' });

      await controller.cancel('res-1', makeReq('OFFICE_ADMIN', 'admin-id'));

      expect(svcMock.cancel).toHaveBeenCalledWith('res-1', 'admin-id', 'OFFICE_ADMIN');
    });

    it('przekazuje rolę użytkownika do svc.cancel', async () => {
      svcMock.cancel.mockResolvedValue(makeReservation());

      await controller.cancel('res-1', makeReq('SUPER_ADMIN', 'sa-id'));

      const [, , role] = svcMock.cancel.mock.calls[0];
      expect(role).toBe('SUPER_ADMIN');
    });

    it('propaguje ForbiddenException z serwisu', async () => {
      svcMock.cancel.mockRejectedValue(new ForbiddenException());

      await expect(controller.cancel('res-1', makeReq('END_USER', 'other')))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // GET /reservations/:id
  // ══════════════════════════════════════════════════════════
  describe('GET /:id — findOne()', () => {

    it('zwraca rezerwację po id', async () => {
      const res = makeReservation();
      svcMock.findOne.mockResolvedValue(res);

      const result = await controller.findOne('res-1');

      expect(svcMock.findOne).toHaveBeenCalledWith('res-1');
      expect(result.id).toBe('res-1');
    });
  });
});
