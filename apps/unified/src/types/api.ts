// Manual API type interfaces (replaces `as any` in client.ts)

export interface Desk {
  id:           string;
  name:         string;
  code:         string;
  locationId:   string;
  floor?:       string | null;
  zone?:        string | null;
  isActive:     boolean;
  isOccupied?:  boolean;
  hardwareId?:  string | null;
  qrToken?:     string;
  currentReservation?: {
    id:        string;
    userId:    string;
    startTime: string;
    endTime:   string;
    qrToken:   string;
    user?:     { firstName: string; lastName: string };
  } | null;
  checkins?: Array<{ id: string; userId: string; checkedInAt: string }>;
  posX?: number | null;
  posY?: number | null;
}

export interface Reservation {
  id:         string;
  deskId:     string;
  userId:     string;
  date:       string;
  startTime:  string;
  endTime:    string;
  status:     string;
  qrToken:    string;
  desk?:      { name: string; code: string };
  user?:      { firstName: string; lastName: string; email: string };
}

export interface User {
  id:             string;
  email:          string;
  firstName:      string;
  lastName:       string;
  role:           string;
  organizationId: string;
  cardUid?:       string | null;
  isActive:       boolean;
}

export interface Gateway {
  id:         string;
  name:       string;
  locationId: string;
  isOnline:   boolean;
  ipAddress?: string | null;
  version?:   string | null;
  lastSeen?:  string | null;
}

export interface Device {
  id:           string;
  hardwareId:   string;
  gatewayId?:   string | null;
  deskId?:      string | null;
  isOnline:     boolean;
  rssi?:        number | null;
  firmwareVersion?: string | null;
  lastSeen?:    string | null;
}

export interface Location {
  id:                string;
  name:              string;
  address?:          string | null;
  organizationId:    string;
  ledColorFree?:     string | null;
  ledColorOccupied?: string | null;
  ledColorReserved?: string | null;
  ledBrightness?:    number | null;
  floorPlanUrl?:     string | null;
}

export interface ApiError {
  message:    string;
  statusCode: number;
  error?:     string;
}
