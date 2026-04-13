import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException }    from '@nestjs/common';
import { ReservationsService }  from './reservations.service';
import { PrismaService }        from '../../database/prisma.service';
import { LedEventsService }     from '../../shared/led-events.service';
import { GatewaysService }      from '../gateways/gateways.service';
import { ReservationStatus }    from '@prisma/client';

const mockPrisma = {
  desk:        { findUnique: jest.fn() },
  reservation: {
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  checkin: { updateMany: jest.fn() },
};

const mockLedEvents = { emit: jest.fn() };
const mockGateways  = { findGatewayForDesk: jest.fn(), sendBeaconCommand: jest.fn() };

// ── Fixtures ──────────────────────────────────────────────────

const baseDeskData = {
  id:       'desk-1',
  name:     'Desk 1',
  status:   'ACTIVE',
  location: {
    openTime:       '08:00',
    closeTime:      '18:00',
    maxDaysAhead:   30,
    maxHoursPerDay: 8,
    timezone:       'Europe/Warsaw',
  },
};

// Tomorrow's date so maxDaysAhead check passes
const tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const dateStr   = tomorrow.toISOString().slice(0, 10);
// 09:00–10:00 UTC — within 08:00–18:00 office hours
const startTime = `${dateStr}T09:00:00.000Z`;
const endTime   = `${dateStr}T10:00:00.000Z`;

const baseDto = { deskId: 'desk-1', date: dateStr, startTime, endTime };

// ── Tests ─────────────────────────────────────────────────────

describe('ReservationsService — create()', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService,    useValue: mockPrisma },
        { provide: LedEventsService, useValue: mockLedEvents },
        { provide: GatewaysService,  useValue: mockGateways },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
    // Default: no gateway → skip beacon notify
    mockGateways.findGatewayForDesk.mockResolvedValue(null);
  });

  it('throws ConflictException when desk is already reserved for the time slot', async () => {
    mockPrisma.desk.findUnique.mockResolvedValue(baseDeskData);
    mockPrisma.reservation.findFirst.mockResolvedValue({ id: 'existing-res' }); // conflict!

    await expect(service.create('actor-1', baseDto)).rejects.toThrow(ConflictException);
    expect(mockPrisma.reservation.create).not.toHaveBeenCalled();
  });

  it('creates reservation with CONFIRMED status when no conflict exists', async () => {
    const created = {
      id: 'new-res', ...baseDto,
      status: ReservationStatus.CONFIRMED,
      desk: { name: 'Desk 1', code: 'D1' },
    };

    mockPrisma.desk.findUnique.mockResolvedValue(baseDeskData);
    mockPrisma.reservation.findFirst.mockResolvedValue(null); // no conflict
    mockPrisma.reservation.create.mockResolvedValue(created);

    const result = await service.create('actor-1', baseDto);

    expect(result.status).toBe(ReservationStatus.CONFIRMED);
    expect(mockPrisma.reservation.create).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictException when reservation duration exceeds maxHoursPerDay', async () => {
    const deskWith2h = { ...baseDeskData, location: { ...baseDeskData.location, maxHoursPerDay: 2 } };
    // 9-hour slot — exceeds 2h limit
    const longDto = { ...baseDto, endTime: `${dateStr}T18:00:00.000Z` };

    mockPrisma.desk.findUnique.mockResolvedValue(deskWith2h);

    await expect(service.create('actor-1', longDto)).rejects.toThrow(ConflictException);
    expect(mockPrisma.reservation.findFirst).not.toHaveBeenCalled();
  });

  it('throws ConflictException when reservation starts before office open time', async () => {
    // 06:00 UTC — before openTime 08:00
    const earlyDto = {
      ...baseDto,
      startTime: `${dateStr}T06:00:00.000Z`,
      endTime:   `${dateStr}T07:00:00.000Z`,
    };

    mockPrisma.desk.findUnique.mockResolvedValue(baseDeskData);

    await expect(service.create('actor-1', earlyDto)).rejects.toThrow(ConflictException);
    expect(mockPrisma.reservation.findFirst).not.toHaveBeenCalled();
  });
});
