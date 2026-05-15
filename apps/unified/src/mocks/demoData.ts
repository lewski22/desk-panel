/**
 * Demo mode fixtures — used when VITE_DEMO_MODE=true
 * Realistic data for 1 org / 2 locations / ~20 desks
 */

const ORG_ID  = 'demo-org-1';
const LOC1_ID = 'demo-loc-1';
const LOC2_ID = 'demo-loc-2';

export const DEMO_USER = {
  id:             'demo-user-1',
  email:          'demo@reserti.demo',
  firstName:      'Demo',
  lastName:       'Admin',
  role:           'SUPER_ADMIN',
  organizationId: ORG_ID,
  enabledModules: ['reports', 'integrations', 'insights', 'graph'],
  subscriptionStatus:  null,
  mustChangePassword:  false,
  accessToken:    'demo-token',
};

const makeDesk = (
  id: string, code: string, name: string, locId: string,
  isOccupied = false, reserved = false, floor = '1', zone = 'Open Space',
) => ({
  id, code, name, locationId: locId, floor, zone,
  status: 'ACTIVE', isOnline: true, isOccupied,
  currentReservation: reserved ? { id: `res-${id}`, startTime: '09:00', endTime: '17:00' } : null,
  currentCheckin: isOccupied ? { user: { firstName: 'Anna', lastName: 'Kowalska' } } : null,
  posX: null, posY: null, rotation: 0, width: 2, height: 1,
});

export const DEMO_LOCATIONS = [
  { id: LOC1_ID, organizationId: ORG_ID, name: 'Warszawa HQ', address: 'ul. Marszałkowska 1', city: 'Warszawa',
    timezone: 'Europe/Warsaw', isActive: true, openTime: '08:00', closeTime: '18:00',
    maxDaysAhead: 14, maxHoursPerDay: 8, gridSize: 40 },
  { id: LOC2_ID, organizationId: ORG_ID, name: 'Kraków Office', address: 'ul. Floriańska 22', city: 'Kraków',
    timezone: 'Europe/Warsaw', isActive: true, openTime: '08:00', closeTime: '17:00',
    maxDaysAhead: 14, maxHoursPerDay: 8, gridSize: 40 },
];

export const DEMO_DESKS = [
  makeDesk('d1',  'A01', 'Biurko A01', LOC1_ID, false, false, '1', 'Open Space'),
  makeDesk('d2',  'A02', 'Biurko A02', LOC1_ID, true,  false, '1', 'Open Space'),
  makeDesk('d3',  'A03', 'Biurko A03', LOC1_ID, false, true,  '1', 'Open Space'),
  makeDesk('d4',  'A04', 'Biurko A04', LOC1_ID, true,  false, '1', 'Open Space'),
  makeDesk('d5',  'A05', 'Biurko A05', LOC1_ID, false, false, '1', 'Open Space'),
  makeDesk('d6',  'A06', 'Biurko A06', LOC1_ID, false, true,  '1', 'Open Space'),
  makeDesk('d7',  'B01', 'Biurko B01', LOC1_ID, false, false, '1', 'Strefa ciszy'),
  makeDesk('d8',  'B02', 'Biurko B02', LOC1_ID, true,  false, '1', 'Strefa ciszy'),
  makeDesk('d9',  'B03', 'Biurko B03', LOC1_ID, false, false, '1', 'Strefa ciszy'),
  makeDesk('d10', 'B04', 'Biurko B04', LOC1_ID, false, true,  '1', 'Strefa ciszy'),
  makeDesk('d11', 'C01', 'Biurko C01', LOC1_ID, true,  false, '2', 'Piętro 2'),
  makeDesk('d12', 'C02', 'Biurko C02', LOC1_ID, false, false, '2', 'Piętro 2'),
  makeDesk('d13', 'K01', 'Biurko K01', LOC2_ID, false, false, '1', 'Kraków Floor'),
  makeDesk('d14', 'K02', 'Biurko K02', LOC2_ID, true,  false, '1', 'Kraków Floor'),
  makeDesk('d15', 'K03', 'Biurko K03', LOC2_ID, false, true,  '1', 'Kraków Floor'),
];

const today = new Date().toISOString().slice(0, 10);

export const DEMO_RESERVATIONS = [
  { id: 'res1', deskId: 'd3', userId: DEMO_USER.id, date: today,
    startTime: new Date(`${today}T09:00:00`).toISOString(),
    endTime:   new Date(`${today}T17:00:00`).toISOString(),
    status: 'CONFIRMED', desk: { code: 'A03', name: 'Biurko A03', location: { name: 'Warszawa HQ' } } },
  { id: 'res2', deskId: 'd6', userId: DEMO_USER.id, date: today,
    startTime: new Date(`${today}T10:00:00`).toISOString(),
    endTime:   new Date(`${today}T14:00:00`).toISOString(),
    status: 'CONFIRMED', desk: { code: 'A06', name: 'Biurko A06', location: { name: 'Warszawa HQ' } } },
];

export const DEMO_STATS = {
  totalDesks:     15,
  activeDesks:    15,
  occupiedNow:    5,
  reservedToday:  6,
  checkinRate:    72,
  avgOccupancy:   58,
  trend: { occupancy: +4, checkins: -2 },
};

export const DEMO_ORG = {
  id: ORG_ID, name: 'Reserti Demo', slug: 'reserti-demo',
  plan: 'enterprise', isActive: true, enabledModules: ['reports','insights','integrations','graph'],
  limitDesks: null, limitUsers: null, limitGateways: null, limitLocations: null,
};

export const DEMO_RESOURCES = [
  { id: 'r1', locationId: LOC1_ID, type: 'ROOM',    name: 'Sala Alpha',  code: 'RM-A01', capacity: 8, floor: '1', zone: 'Conference', status: 'ACTIVE', amenities: ['whiteboard', 'projector'] },
  { id: 'r2', locationId: LOC1_ID, type: 'ROOM',    name: 'Sala Beta',   code: 'RM-A02', capacity: 4, floor: '1', zone: 'Conference', status: 'ACTIVE', amenities: ['tv'] },
  { id: 'r3', locationId: LOC1_ID, type: 'PARKING', name: 'Parking P01', code: 'P-W01',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: [] },
  { id: 'r4', locationId: LOC1_ID, type: 'PARKING', name: 'Parking P02', code: 'P-W02',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: [] },
  { id: 'r5', locationId: LOC1_ID, type: 'PARKING', name: 'Parking P03', code: 'P-W03',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: ['electric'] },
  { id: 'r6', locationId: LOC1_ID, type: 'PARKING', name: 'Parking P04', code: 'P-W04',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: [] },
  { id: 'r7', locationId: LOC1_ID, type: 'PARKING', name: 'Parking P05', code: 'P-W05',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: [] },
  { id: 'r8', locationId: LOC2_ID, type: 'PARKING', name: 'Parking K01', code: 'P-K01',  capacity: 1, floor: null, zone: null,        status: 'ACTIVE', amenities: [] },
];

const todayIso = new Date().toISOString();
const todayStart = (h: number) => new Date(new Date().setHours(h, 0, 0, 0)).toISOString();

export const DEMO_PARKING_BLOCKS = [
  { id: 'pb1', resourceId: 'r3', startTime: todayStart(8),  endTime: todayStart(17), reason: 'Rezerwacja dzienna', createdAt: todayIso },
  { id: 'pb2', resourceId: 'r4', startTime: todayStart(9),  endTime: todayStart(13), reason: 'Spotkanie z klientem', createdAt: todayIso },
];

export const DEMO_VISITORS = [
  { id: 'v1', locationId: LOC1_ID, hostUserId: DEMO_USER.id,
    firstName: 'Jan',  lastName: 'Nowak',    email: 'jan.nowak@external.com',
    company: 'Acme Ltd', visitDate: todayIso,
    purpose: 'Spotkanie biznesowe', status: 'INVITED', qrToken: 'visitor-qr-1',
    checkedInAt: null, checkedOutAt: null },
  { id: 'v2', locationId: LOC1_ID, hostUserId: DEMO_USER.id,
    firstName: 'Anna', lastName: 'Wiśniewska', email: 'anna.w@partner.pl',
    company: 'Partner Sp. z o.o.', visitDate: todayIso,
    purpose: 'Prezentacja produktu', status: 'CHECKED_IN', qrToken: 'visitor-qr-2',
    checkedInAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), checkedOutAt: null },
  { id: 'v3', locationId: LOC1_ID, hostUserId: DEMO_USER.id,
    firstName: 'Piotr', lastName: 'Kowalczyk', email: null,
    company: 'Freelancer', visitDate: todayIso,
    purpose: null, status: 'CANCELLED', qrToken: 'visitor-qr-3',
    checkedInAt: null, checkedOutAt: null },
  { id: 'v4', locationId: LOC2_ID, hostUserId: DEMO_USER.id,
    firstName: 'Maria', lastName: 'Zając', email: 'maria@corp.eu',
    company: 'Corp EU', visitDate: todayIso,
    purpose: 'Audyt', status: 'CHECKED_OUT', qrToken: 'visitor-qr-4',
    checkedInAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    checkedOutAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
];

// Weekly attendance — format expected by WeeklyViewPage: { rows: [{ user, days: [{ date, status }] }] }
const DEMO_TEAM = [
  { firstName: 'Demo',    lastName: 'Admin'     },
  { firstName: 'Karol',   lastName: 'Kowalski'  },
  { firstName: 'Marta',   lastName: 'Nowak'     },
  { firstName: 'Tomasz',  lastName: 'Wiśniewski' },
  { firstName: 'Agata',   lastName: 'Zielińska' },
];

function makeWeekDays(weekOffset = 0): string[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() || 7) - 1) + weekOffset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const STATUSES: Array<'office' | 'reserved' | 'unknown'> = ['office', 'office', 'reserved', 'unknown', 'office'];

export const DEMO_ATTENDANCE = {
  rows: DEMO_TEAM.map((user, ui) => ({
    user,
    days: makeWeekDays(0).map((date, di) => ({
      date,
      status: (ui + di) % 4 === 3 ? 'unknown' : STATUSES[(ui + di) % STATUSES.length],
    })),
  })),
};

export const DEMO_REPORT_CHECKINS_BY_DAY = {
  data: Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), count: [8, 12, 6, 15, 10, 9, 11][i] };
  }),
};

export const DEMO_REPORT_PER_DESK = {
  data: DEMO_DESKS.slice(0, 5).map((desk, i) => ({
    deskId: desk.id, deskCode: desk.code, deskName: desk.name, checkins: [14, 11, 9, 7, 5][i],
  })),
};

export const DEMO_REPORT_PER_USER = {
  data: [
    { userId: DEMO_USER.id, firstName: 'Demo', lastName: 'Admin', email: 'demo@reserti.demo', checkins: 12 },
  ],
};

export const DEMO_REPORT_METHODS = {
  data: [
    { method: 'WEB', count: 14 }, { method: 'QR', count: 6 },
    { method: 'NFC', count: 3  }, { method: 'MANUAL', count: 2 },
  ],
};
