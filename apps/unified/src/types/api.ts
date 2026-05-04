export interface Desk {
  id: string;
  locationId: string;
  name: string;
  code: string;
  floor?: string;
  zone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  qrToken: string;
  posX?: number;
  posY?: number;
  rotation?: number;
  width?: number;
  height?: number;
}

export interface Reservation {
  id: string;
  deskId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';
  qrToken: string;
  notes?: string;
  checkedInAt?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  isActive: boolean;
  cardUid?: string;
}

export interface Gateway {
  id: string;
  name: string;
  locationId: string;
  isOnline: boolean;
  ipAddress?: string;
  version?: string;
  lastSeen?: string;
}

export interface Device {
  id: string;
  hardwareId: string;
  deskId?: string;
  gatewayId?: string;
  isOnline: boolean;
  firmwareVersion?: string;
  rssi?: number;
  lastSeen?: string;
  otaStatus?: string;
}

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  city?: string;
  timezone: string;
  isActive: boolean;
  openTime: string;
  closeTime: string;
  maxDaysAhead: number;
  maxHoursPerDay: number;
  ledColorFree: string;
  ledColorOccupied: string;
  ledColorReserved: string;
  ledColorGuestReserved: string;
  ledBrightness: number;
}

export interface ApiError {
  message: string | string[];
  statusCode: number;
}
