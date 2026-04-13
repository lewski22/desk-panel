import { Test, TestingModule } from '@nestjs/testing';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { AzureAuthService } from './azure-auth.service';

const mockAuthService = {
  login:          jest.fn(),
  refresh:        jest.fn(),
  logout:         jest.fn(),
  changePassword: jest.fn(),
};

const mockAzureService = {
  loginWithAzureToken: jest.fn(),
  checkSsoAvailable:   jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService,      useValue: mockAuthService },
        { provide: AzureAuthService, useValue: mockAzureService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  // ── login ─────────────────────────────────────────────────────

  describe('login', () => {
    it('returns access and refresh tokens for authenticated user', async () => {
      const tokens = { accessToken: 'jwt-access', refreshToken: 'jwt-refresh' };
      mockAuthService.login.mockResolvedValue(tokens);

      const req = { user: { id: 'user-1', email: 'test@example.com' } };
      const result = await controller.login(req);

      expect(result).toEqual(tokens);
      expect(mockAuthService.login).toHaveBeenCalledWith(req.user);
    });

    it('has @Throttle rate-limiting set to 5 requests per minute', () => {
      // Guards against accidental removal of the @Throttle decorator from login
      const metadata = Reflect.getMetadata(
        'throttler:options',
        AuthController.prototype,
        'login',
      );
      expect(metadata).toBeDefined();
      const [defaultConfig] = metadata;
      expect(defaultConfig).toMatchObject({ limit: 5, ttl: 60_000 });
    });
  });

  // ── refresh ───────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns new token pair when refresh token is valid', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      mockAuthService.refresh.mockResolvedValue(tokens);

      const result = await controller.refresh({ refreshToken: 'old-refresh' });

      expect(result).toEqual(tokens);
      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-refresh');
    });
  });
});
