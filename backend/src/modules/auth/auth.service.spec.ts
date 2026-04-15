import { Test, TestingModule }              from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService }                        from '@nestjs/jwt';
import { ConfigService }                     from '@nestjs/config';
import { AuthService }                       from './auth.service';
import { PrismaService }                     from '../../database/prisma.service';
import * as bcrypt                           from 'bcrypt';

// ── Mocki ─────────────────────────────────────────────────────
const prismaMock = {
  user: {
    findUnique:        jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update:            jest.fn(),
  },
  refreshToken: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    delete:     jest.fn(),
    deleteMany: jest.fn(),
  },
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('mocked-jwt-token'),
};

const configMock = {
  get: jest.fn((key: string, def?: any) => def ?? 'mock-secret'),
};

// ── Fixtures ──────────────────────────────────────────────────
const makeUser = (overrides: Record<string, any> = {}) => ({
  id:           'user-1',
  email:        'test@example.com',
  firstName:    'Jan',
  lastName:     'Kowalski',
  role:         'END_USER',
  isActive:     true,
  deletedAt:    null,
  passwordHash: '$2b$10$validhash',   // placeholder — nadpisywany przez bcrypt mock
  ...overrides,
});

const makeRefreshRecord = (overrides: Record<string, any> = {}) => ({
  id:        'rt-1',
  token:     'valid-refresh-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // +7 dni
  user:      makeUser(),
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService,  useValue: prismaMock  },
        { provide: JwtService,     useValue: jwtMock     },
        { provide: ConfigService,  useValue: configMock  },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ══════════════════════════════════════════════════════════
  // validateUser()
  // ══════════════════════════════════════════════════════════
  describe('validateUser()', () => {

    it('zwraca null gdy użytkownik nie istnieje', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nobody@x.pl', 'pass');
      expect(result).toBeNull();
    });

    it('zwraca null gdy konto nieaktywne', async () => {
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

      const result = await service.validateUser('test@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('zwraca null dla konta Azure SSO (brak hasła lokalnego)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        makeUser({ passwordHash: 'AZURE_SSO_ONLY' })
      );

      const result = await service.validateUser('sso@firma.pl', 'anything');
      expect(result).toBeNull();
    });

    it('zwraca null gdy hasło nieprawidłowe', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      prismaMock.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));

      const result = await service.validateUser('test@example.com', 'wrong-password');
      expect(result).toBeNull();
    });

    it('zwraca użytkownika gdy email i hasło poprawne', async () => {
      const password = 'correct-password';
      const hash     = await bcrypt.hash(password, 10);
      const user     = makeUser({ passwordHash: hash });
      prismaMock.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser('test@example.com', password);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-1');
    });
  });

  // ══════════════════════════════════════════════════════════
  // login()
  // ══════════════════════════════════════════════════════════
  describe('login()', () => {

    beforeEach(() => {
      prismaMock.refreshToken.create.mockResolvedValue({});
    });

    it('zwraca accessToken i refreshToken', async () => {
      jwtMock.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(makeUser() as any);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('zwraca dane użytkownika (bez passwordHash)', async () => {
      const user = makeUser();
      const result = await service.login(user as any);

      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.user.role).toBe(user.role);
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('zapisuje refresh token w bazie', async () => {
      jwtMock.sign
        .mockReturnValueOnce('at')
        .mockReturnValueOnce('rt');

      await service.login(makeUser() as any);

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ token: 'rt', userId: 'user-1' }),
        })
      );
    });

    it('JWT payload zawiera sub, email, role', async () => {
      const user = makeUser({ role: 'SUPER_ADMIN' });
      await service.login(user as any);

      const firstSignCall = jwtMock.sign.mock.calls[0][0];
      expect(firstSignCall.sub).toBe('user-1');
      expect(firstSignCall.email).toBe('test@example.com');
      expect(firstSignCall.role).toBe('SUPER_ADMIN');
    });
  });

  // ══════════════════════════════════════════════════════════
  // refresh()
  // ══════════════════════════════════════════════════════════
  describe('refresh()', () => {

    it('rzuca UnauthorizedException gdy token nie istnieje', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nonexistent-token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rzuca UnauthorizedException gdy token wygasł', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ expiresAt: new Date(Date.now() - 1000) }) // przeszłość
      );

      await expect(service.refresh('expired-token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rzuca UnauthorizedException gdy konto dezaktywowane po wystawieniu tokenu', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ user: makeUser({ isActive: false }) })
      );
      prismaMock.refreshToken.delete.mockResolvedValue({});

      await expect(service.refresh('valid-token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rzuca UnauthorizedException gdy konto usunięte (deletedAt)', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(
        makeRefreshRecord({ user: makeUser({ deletedAt: new Date() }) })
      );
      prismaMock.refreshToken.delete.mockResolvedValue({});

      await expect(service.refresh('deleted-user-token'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rotuje token — usuwa stary i wydaje nowy', async () => {
      prismaMock.refreshToken.findUnique.mockResolvedValue(makeRefreshRecord());
      prismaMock.refreshToken.delete.mockResolvedValue({});
      prismaMock.refreshToken.create.mockResolvedValue({});
      jwtMock.sign.mockReturnValue('new-token');

      const result = await service.refresh('valid-refresh-token');

      expect(prismaMock.refreshToken.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } })
      );
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // changePassword()
  // ══════════════════════════════════════════════════════════
  describe('changePassword()', () => {

    it('rzuca BadRequestException dla konta SSO', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue(
        makeUser({ passwordHash: 'AZURE_SSO_ONLY' })
      );

      await expect(service.changePassword('user-1', 'any', 'new'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rzuca UnauthorizedException gdy aktualne hasło błędne', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUniqueOrThrow.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(service.changePassword('user-1', 'wrong', 'new-pass'))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rzuca BadRequestException gdy nowe hasło = stare', async () => {
      const password = 'same-password';
      const hash     = await bcrypt.hash(password, 10);
      prismaMock.user.findUniqueOrThrow.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(service.changePassword('user-1', password, password))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('aktualizuje passwordHash i unieważnia wszystkie tokeny', async () => {
      const oldPass = 'old-password';
      const hash    = await bcrypt.hash(oldPass, 10);
      prismaMock.user.findUniqueOrThrow.mockResolvedValue(makeUser({ passwordHash: hash }));
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await service.changePassword('user-1', oldPass, 'new-password');

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data:  expect.objectContaining({ passwordHash: expect.any(String) }),
        })
      );
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } })
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // logout()
  // ══════════════════════════════════════════════════════════
  describe('logout()', () => {

    it('usuwa token z bazy danych', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('my-refresh-token');

      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: 'my-refresh-token' } })
      );
    });

    it('nie rzuca błędu gdy token nie istnieje (idempotent)', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('nonexistent-token')).resolves.not.toThrow();
    });
  });
});
