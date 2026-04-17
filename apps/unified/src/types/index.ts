export interface LocationLimits {
  openTime:       string;
  closeTime:      string;
  maxDaysAhead:   number;
  maxHoursPerDay: number;
  timezone:       string;
}

export type DeskStatus = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'OFFLINE';

export interface DeskMapItem {
  id: string;
  name: string;
  code: string;
  floor: string | null;
  zone: string | null;
  isOnline: boolean;
  isOccupied: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  // Floor Plan position (Sprint D)
  posX?:     number | null;
  posY?:     number | null;
  rotation?: number;
  width?:    number;
  height?:   number;

  currentCheckin?: {
    userId:      string;
    checkedInAt: string;
    user?:       { firstName: string; lastName: string };
  } | null;
  currentReservation?: {
    id: string;
    user: { firstName: string; lastName: string };
    startTime: string;
    endTime: string;
  } | null;
}

export interface Reservation {
  id: string;
  desk: { name: string; code: string; floor: string | null; zone: string | null };
  user: { firstName: string; lastName: string; email: string };
  date: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';
  checkin?: { checkedInAt: string; checkedOutAt: string | null; method: string } | null;
}

export interface Checkin {
  id: string;
  deskId: string;
  userId: string;
  method: 'NFC' | 'QR' | 'MANUAL';
  checkedInAt: string;
  checkedOutAt: string | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}
