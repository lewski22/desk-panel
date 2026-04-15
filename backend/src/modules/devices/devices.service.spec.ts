import { Test, TestingModule }            from '@nestjs/testing';
import {
  ConflictException, ForbiddenException, NotFoundException, BadRequestException,
}                                          from '@nestjs/common';
import { DevicesService }                  from './devices.service';
import { PrismaService }                   from '../../database/prisma.service';
import { GatewaysService }                 from '../gateways/gateways.service';
import { ConfigService }                   from '@nestjs/config';

// ── Mocki ─────────────────────────────────────────────────────
const prismaMock = {
  device: {
    findUnique: jest.fn(),
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    upsert:     jest.fn(),
    create:     jest.fn(),
  },
  event: { create: jest.fn().mockResolvedValue({}) },
};

const gatewaysMock = {
  addBeaconCredentials: jest.fn(),
  sendBeaconCommand:    jest.fn(),
};

const configMock = {
  get: jest.fn((key: string, defaultVal?: any) => defaultVal),
};

// ── Fixtures ──────────────────────────────────────────────────
const ORG_ID        = 'org-1';
const OTHER_ORG_ID  = 'org-2';
const DEVICE_ID     = 'device-1';
const GATEWAY_ID    = 'gw-1';
const DESK_ID       = 'desk-1';
const HW_ID         = 'esp32-abc123';

const makeDevice = (overrides: Record<string, any> = {}) => ({
  id:              DEVICE_ID,
  hardwareId:      HW_ID,
  deskId:          DESK_ID,
  gatewayId:       GATEWAY_ID,
  firmwareVersion: '1.0.0',
  isOnline:        true,
  lastSeen:        new Date(),
  otaStatus:       null,
  otaVersion:      null,
  otaStartedAt:    null,
  otaFinishedAt:   null,
  mqttUsername:    'beacon_abc',
  mqttPasswordHash:'$2a$10$...',
  desk:            { id: DESK_ID },
  gateway:         {
    id:       GATEWAY_ID,
    location: { organizationId: ORG_ID },
  },
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────
describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService,  useValue: prismaMock   },
        { provide: GatewaysService, useValue: gatewaysMock },
        { provide: ConfigService,   useValue: configMock   },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  // ══════════════════════════════════════════════════════════
  // assertBelongsToOrg() — org isolation guard
  // ══════════════════════════════════════════════════════════
  describe('assertBelongsToOrg()', () => {

    it('rzuca NotFoundException gdy urządzenie nie istnieje', async () => {
      prismaMock.device.findUnique.mockResolvedValue(null);

      await expect(service.assertBelongsToOrg(DEVICE_ID, ORG_ID))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('rzuca ForbiddenException gdy urządzenie należy do innej org', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ gateway: { location: { organizationId: OTHER_ORG_ID } } })
      );

      await expect(service.assertBelongsToOrg(DEVICE_ID, ORG_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rzuca ForbiddenException gdy urządzenie nie ma przypisanego gateway', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ gateway: null })
      );

      await expect(service.assertBelongsToOrg(DEVICE_ID, ORG_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('zwraca urządzenie gdy należy do właściwej org', async () => {
      const dev = makeDevice();
      prismaMock.device.findUnique.mockResolvedValue(dev);

      const result = await service.assertBelongsToOrg(DEVICE_ID, ORG_ID);
      expect(result.id).toBe(DEVICE_ID);
    });
  });

  // ══════════════════════════════════════════════════════════
  // triggerOta()
  // ══════════════════════════════════════════════════════════
  describe('triggerOta()', () => {

    beforeEach(() => {
      // Mock getLatestFirmware przez fetch — zwracamy null domyślnie
      jest.spyOn(service, 'getLatestFirmware').mockResolvedValue({
        version:     '1.2.0',
        url:         'https://github.com/releases/v1.2.0/firmware.bin',
        size:        512000,
        publishedAt: '2025-06-01T00:00:00Z',
      });
    });

    it('rzuca ConflictException gdy OTA już w toku', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ otaStatus: 'in_progress' })
      );

      await expect(service.triggerOta(DEVICE_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('rzuca BadRequestException gdy beacon nie ma przypisanego biurka', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ deskId: null })
      );

      await expect(service.triggerOta(DEVICE_ID))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rzuca ForbiddenException gdy actorOrgId podany i nie pasuje', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ gateway: { location: { organizationId: OTHER_ORG_ID } } })
      );

      await expect(service.triggerOta(DEVICE_ID, ORG_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ustawia otaStatus=in_progress przed wysłaniem komendy', async () => {
      prismaMock.device.findUnique.mockResolvedValue(makeDevice());
      prismaMock.device.update.mockResolvedValue(makeDevice({ otaStatus: 'in_progress' }));

      await service.triggerOta(DEVICE_ID);

      expect(prismaMock.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            otaStatus:   'in_progress',
            otaVersion:  '1.2.0',
            otaStartedAt: expect.any(Date),
          }),
        })
      );
    });

    it('zwraca payload OTA z url i version', async () => {
      prismaMock.device.findUnique.mockResolvedValue(makeDevice());
      prismaMock.device.update.mockResolvedValue(makeDevice());

      const result = await service.triggerOta(DEVICE_ID);

      expect(result.triggered).toBe(true);
      expect(result._ota_payload.command).toBe('OTA_UPDATE');
      expect(result._ota_payload.params.version).toBe('1.2.0');
      expect(result._ota_payload.params.url).toContain('github.com');
    });

    it('bez actorOrgId — nie sprawdza org (OWNER flow)', async () => {
      prismaMock.device.findUnique.mockResolvedValue(
        makeDevice({ gateway: { location: { organizationId: OTHER_ORG_ID } } })
      );
      prismaMock.device.update.mockResolvedValue(makeDevice());

      // Bez actorOrgId — powinno przejść nawet dla obcej org
      const result = await service.triggerOta(DEVICE_ID);
      expect(result.triggered).toBe(true);
    });

    it('rzuca BadRequestException gdy brak releases na GitHub', async () => {
      prismaMock.device.findUnique.mockResolvedValue(makeDevice());
      jest.spyOn(service, 'getLatestFirmware').mockResolvedValue(null);

      await expect(service.triggerOta(DEVICE_ID))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════
  // timeoutStaleOta() — cron co 10 min
  // ══════════════════════════════════════════════════════════
  describe('timeoutStaleOta()', () => {

    it('ustawia status=failed dla in_progress starszych niż 10 min', async () => {
      prismaMock.device.updateMany.mockResolvedValue({ count: 2 });

      await service.timeoutStaleOta();

      const callArgs = prismaMock.device.updateMany.mock.calls[0][0];
      expect(callArgs.where.otaStatus).toBe('in_progress');
      expect(callArgs.where.otaStartedAt.lt).toBeInstanceOf(Date);
      // cutoff powinien być < 10 min temu (sprawdzamy że jest Date)
      const cutoff = callArgs.where.otaStartedAt.lt as Date;
      const diffMin = (Date.now() - cutoff.getTime()) / 60000;
      expect(diffMin).toBeCloseTo(10, 0);
      expect(callArgs.data.otaStatus).toBe('failed');
      expect(callArgs.data.otaFinishedAt).toBeInstanceOf(Date);
    });

    it('nie aktualizuje nic gdy brak stale OTA', async () => {
      prismaMock.device.updateMany.mockResolvedValue({ count: 0 });

      await service.timeoutStaleOta();
      // Nie rzuca błędu
      expect(prismaMock.device.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════
  // heartbeat() — OTA korelacja
  // ══════════════════════════════════════════════════════════
  describe('heartbeat()', () => {

    it('ustawia otaStatus=success gdy firmwareVersion === otaVersion', async () => {
      const device = makeDevice({
        otaStatus:  'in_progress',
        otaVersion: '1.2.0',
      });
      prismaMock.device.update.mockResolvedValue({ ...device, firmwareVersion: '1.2.0' });

      await service.heartbeat(HW_ID, -60, '1.2.0');

      // Pierwsze update — heartbeat
      const heartbeatCall = prismaMock.device.update.mock.calls[0][0];
      expect(heartbeatCall.data.firmwareVersion).toBe('1.2.0');

      // Drugie update — OTA korelacja
      const otaCall = prismaMock.device.update.mock.calls[1][0];
      expect(otaCall.data.otaStatus).toBe('success');
      expect(otaCall.data.otaFinishedAt).toBeInstanceOf(Date);
    });

    it('NIE aktualizuje otaStatus gdy OTA nie jest in_progress', async () => {
      const device = makeDevice({ otaStatus: null });
      prismaMock.device.update.mockResolvedValue({ ...device, firmwareVersion: '1.2.0' });

      await service.heartbeat(HW_ID, -60, '1.2.0');

      // Tylko jeden update — heartbeat, nie ma drugiego (OTA correlation)
      expect(prismaMock.device.update).toHaveBeenCalledTimes(1);
    });

    it('NIE aktualizuje otaStatus gdy firmwareVersion !== otaVersion', async () => {
      const device = makeDevice({
        otaStatus:  'in_progress',
        otaVersion: '1.2.0',
      });
      // Beacon wrócił z inną wersją (stara, nie zaktualizowany)
      prismaMock.device.update.mockResolvedValue({ ...device, firmwareVersion: '1.0.0' });

      await service.heartbeat(HW_ID, -60, '1.0.0');

      expect(prismaMock.device.update).toHaveBeenCalledTimes(1);
    });

    it('aktualizuje isOnline, lastSeen, rssi, firmwareVersion', async () => {
      const device = makeDevice({ otaStatus: null });
      prismaMock.device.update.mockResolvedValue(device);

      await service.heartbeat(HW_ID, -55, '1.1.0');

      const callData = prismaMock.device.update.mock.calls[0][0].data;
      expect(callData.isOnline).toBe(true);
      expect(callData.lastSeen).toBeInstanceOf(Date);
      expect(callData.rssi).toBe(-55);
      expect(callData.firmwareVersion).toBe('1.1.0');
    });
  });

  // ══════════════════════════════════════════════════════════
  // findAll() — filtrowanie po org
  // ══════════════════════════════════════════════════════════
  describe('findAll()', () => {

    it('filtruje po organizationId gdy podany', async () => {
      prismaMock.device.findMany.mockResolvedValue([]);

      await service.findAll(ORG_ID);

      const callArgs = prismaMock.device.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({
        gateway: { location: { organizationId: ORG_ID } },
      });
    });

    it('nie filtruje po org gdy nie podano (OWNER)', async () => {
      prismaMock.device.findMany.mockResolvedValue([]);

      await service.findAll();

      const callArgs = prismaMock.device.findMany.mock.calls[0][0];
      expect(callArgs.where).toBeUndefined();
    });
  });
});
