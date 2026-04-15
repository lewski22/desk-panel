import { Test, TestingModule }           from '@nestjs/testing';
import { DevicesController }             from './devices.controller';
import { DevicesService }                from './devices.service';
import { GatewaysService }               from '../gateways/gateways.service';
import { JwtAuthGuard }                  from '../auth/guards/jwt-auth.guard';
import { RolesGuard }                    from '../auth/guards/roles.guard';

// ── Guard mock — przepuszcza wszystko ────────────────────────
const PassGuard = { canActivate: () => true };

// ── Service mocks ─────────────────────────────────────────────
const svcMock = {
  findAll:         jest.fn(),
  findOne:         jest.fn(),
  provision:       jest.fn(),
  remove:          jest.fn(),
  getLatestFirmware: jest.fn(),
  triggerOta:      jest.fn(),
  triggerOtaAll:   jest.fn(),
};

const gatewaysMock = {
  sendBeaconCommand: jest.fn(),
};

// ── Fixtures ──────────────────────────────────────────────────
const makeReq = (role: string, orgId = 'org-1', email = 'u@example.com') => ({
  user: { id: 'user-1', role, organizationId: orgId, email },
});

const makeDevice = (overrides: Record<string, any> = {}) => ({
  id:              'device-1',
  hardwareId:      'esp32-abc',
  deskId:          'desk-1',
  gatewayId:       'gw-1',
  firmwareVersion: '1.0.0',
  otaStatus:       null,
  desk:            { id: 'desk-1' },
  gateway:         { location: { organizationId: 'org-1' } },
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────
describe('DevicesController', () => {
  let controller: DevicesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        { provide: DevicesService,  useValue: svcMock      },
        { provide: GatewaysService, useValue: gatewaysMock  },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(PassGuard)
      .overrideGuard(RolesGuard).useValue(PassGuard)
      .compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  // ══════════════════════════════════════════════════════════
  // GET /devices — org isolation
  // ══════════════════════════════════════════════════════════
  describe('GET / — findAll() — org isolation', () => {

    it('OWNER widzi wszystko (orgId = undefined)', async () => {
      svcMock.findAll.mockResolvedValue([]);

      await controller.findAll(makeReq('OWNER'));

      expect(svcMock.findAll).toHaveBeenCalledWith(undefined);
    });

    it('SUPER_ADMIN widzi tylko własną org', async () => {
      svcMock.findAll.mockResolvedValue([]);

      await controller.findAll(makeReq('SUPER_ADMIN', 'org-abc'));

      expect(svcMock.findAll).toHaveBeenCalledWith('org-abc');
    });

    it('OFFICE_ADMIN widzi tylko własną org', async () => {
      svcMock.findAll.mockResolvedValue([]);

      await controller.findAll(makeReq('OFFICE_ADMIN', 'org-xyz'));

      expect(svcMock.findAll).toHaveBeenCalledWith('org-xyz');
    });

    it('zwraca listę urządzeń', async () => {
      svcMock.findAll.mockResolvedValue([makeDevice()]);

      const result = await controller.findAll(makeReq('SUPER_ADMIN'));

      expect(result).toHaveLength(1);
      expect(result[0].hardwareId).toBe('esp32-abc');
    });
  });

  // ══════════════════════════════════════════════════════════
  // GET /devices/:id — findOne
  // ══════════════════════════════════════════════════════════
  describe('GET /:id — findOne()', () => {

    it('wywołuje svc.findOne z poprawnym id', async () => {
      svcMock.findOne.mockResolvedValue(makeDevice());

      const result = await controller.findOne('device-1');

      expect(svcMock.findOne).toHaveBeenCalledWith('device-1');
      expect(result.id).toBe('device-1');
    });
  });

  // ══════════════════════════════════════════════════════════
  // POST /devices/:id/command
  // ══════════════════════════════════════════════════════════
  describe('POST /:id/command — command()', () => {

    it('wysyła komendę przez gateway i zwraca sent=true', async () => {
      svcMock.findOne.mockResolvedValue(makeDevice());
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      const result = await controller.command('device-1', {
        command: 'REBOOT',
        params:  undefined,
      });

      expect(gatewaysMock.sendBeaconCommand).toHaveBeenCalledWith(
        'gw-1', 'desk-1', 'REBOOT', undefined
      );
      expect(result.sent).toBe(true);
      expect(result.command).toBe('REBOOT');
    });

    it('IDENTIFY z params — przekazuje params do gateway', async () => {
      svcMock.findOne.mockResolvedValue(makeDevice());
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      await controller.command('device-1', {
        command: 'IDENTIFY',
        params:  { duration: 5000 },
      });

      expect(gatewaysMock.sendBeaconCommand).toHaveBeenCalledWith(
        'gw-1', 'desk-1', 'IDENTIFY', { duration: 5000 }
      );
    });

    it('zwraca deskId i gatewayId w odpowiedzi', async () => {
      svcMock.findOne.mockResolvedValue(makeDevice({ deskId: 'desk-42', gatewayId: 'gw-99' }));
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      const result = await controller.command('device-1', { command: 'REBOOT' });

      expect(result.deskId).toBe('desk-42');
      expect(result.gatewayId).toBe('gw-99');
    });
  });

  // ══════════════════════════════════════════════════════════
  // GET /devices/firmware/latest
  // ══════════════════════════════════════════════════════════
  describe('GET /firmware/latest — firmwareLatest()', () => {

    it('zwraca dane firmware z serwisu', async () => {
      const fw = { version: '1.2.0', url: 'https://github.com/...', size: 512000 };
      svcMock.getLatestFirmware.mockResolvedValue(fw);

      const result = await controller.firmwareLatest();

      expect(svcMock.getLatestFirmware).toHaveBeenCalled();
      expect(result.version).toBe('1.2.0');
    });
  });

  // ══════════════════════════════════════════════════════════
  // POST /devices/:id/ota — org isolation
  // ══════════════════════════════════════════════════════════
  describe('POST /:id/ota — triggerOta()', () => {

    it('OWNER przekazuje actorOrgId=undefined (widzi wszystkie org)', async () => {
      svcMock.triggerOta.mockResolvedValue({
        triggered:    true,
        gatewayId:    'gw-1',
        deskId:       'desk-1',
        oldVersion:   '1.0.0',
        newVersion:   '1.2.0',
        _ota_payload: { command: 'OTA_UPDATE', params: { url: 'http://x', version: '1.2.0' } },
      });
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      await controller.triggerOta('device-1', makeReq('OWNER'));

      expect(svcMock.triggerOta).toHaveBeenCalledWith('device-1', undefined);
    });

    it('SUPER_ADMIN przekazuje swój orgId', async () => {
      svcMock.triggerOta.mockResolvedValue({
        triggered:    true,
        gatewayId:    'gw-1',
        deskId:       'desk-1',
        oldVersion:   '1.0.0',
        newVersion:   '1.2.0',
        _ota_payload: { command: 'OTA_UPDATE', params: { url: 'http://x', version: '1.2.0' } },
      });
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      await controller.triggerOta('device-1', makeReq('SUPER_ADMIN', 'org-abc'));

      expect(svcMock.triggerOta).toHaveBeenCalledWith('device-1', 'org-abc');
    });

    it('wysyła OTA_UPDATE przez gateway po zakończeniu triggerOta', async () => {
      svcMock.triggerOta.mockResolvedValue({
        triggered:    true,
        gatewayId:    'gw-1',
        deskId:       'desk-1',
        oldVersion:   '1.0.0',
        newVersion:   '1.2.0',
        _ota_payload: {
          command: 'OTA_UPDATE',
          params:  { url: 'https://github.com/fw.bin', version: '1.2.0' },
        },
      });
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      await controller.triggerOta('device-1', makeReq('SUPER_ADMIN'));

      expect(gatewaysMock.sendBeaconCommand).toHaveBeenCalledWith(
        'gw-1', 'desk-1', 'OTA_UPDATE',
        { url: 'https://github.com/fw.bin', version: '1.2.0' }
      );
    });

    it('_ota_payload nie jest zwracane w odpowiedzi HTTP', async () => {
      svcMock.triggerOta.mockResolvedValue({
        triggered:    true,
        gatewayId:    'gw-1',
        deskId:       'desk-1',
        oldVersion:   '1.0.0',
        newVersion:   '1.2.0',
        _ota_payload: { command: 'OTA_UPDATE', params: {} },
      });
      gatewaysMock.sendBeaconCommand.mockResolvedValue({});

      const result = await controller.triggerOta('device-1', makeReq('SUPER_ADMIN'));

      expect((result as any)._ota_payload).toBeUndefined();
      expect(result.triggered).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  // POST /devices/ota-all — bulk OTA
  // ══════════════════════════════════════════════════════════
  describe('POST /ota-all — triggerOtaAll()', () => {

    it('OWNER dostaje error — powinien używać OwnerPage', async () => {
      const result = await controller.triggerOtaAll(makeReq('OWNER'));

      expect(svcMock.triggerOtaAll).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('SUPER_ADMIN wyzwala aktualizację dla wszystkich beaconów w org', async () => {
      svcMock.triggerOtaAll.mockResolvedValue({ queued: 3, total: 5 });

      const result = await controller.triggerOtaAll(
        makeReq('SUPER_ADMIN', 'org-1')
      );

      expect(svcMock.triggerOtaAll).toHaveBeenCalledWith('org-1', undefined);
      expect(result.queued).toBe(3);
    });

    it('OFFICE_ADMIN może filtrować po locationId', async () => {
      svcMock.triggerOtaAll.mockResolvedValue({ queued: 1, total: 2 });

      await controller.triggerOtaAll(
        makeReq('OFFICE_ADMIN', 'org-1'), 'loc-A'
      );

      expect(svcMock.triggerOtaAll).toHaveBeenCalledWith('org-1', 'loc-A');
    });

    it('zwraca error gdy brak organizationId w tokenie', async () => {
      const result = await controller.triggerOtaAll(
        makeReq('SUPER_ADMIN', undefined as any)
      );

      expect(svcMock.triggerOtaAll).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ queued: 0, error: expect.any(String) })
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // DELETE /devices/:id — remove
  // ══════════════════════════════════════════════════════════
  describe('DELETE /:id — remove()', () => {

    it('wywołuje svc.remove z poprawnym id', async () => {
      svcMock.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('device-1');

      expect(svcMock.remove).toHaveBeenCalledWith('device-1');
      expect(result).toEqual({ deleted: true });
    });
  });
});
