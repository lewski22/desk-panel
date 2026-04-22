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
  subscriptionStatus: null,
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
